import { NextResponse } from "next/server";
import { OPEN_STATUSES } from "./config";
import { addDays, amsterdamToday, isIsoDate } from "./dates";
import { freeMinutesOn } from "./agenda-server";
import { spawnNext } from "./repeat";
import { DayContext, makePlan, pickTop, rankTasks } from "./score";
import { getDays, getTasks, mutateDay } from "./store";
import type { DayPlan, Task } from "./types";

export const noStore = { "Cache-Control": "no-store" };

export function fail(where: string, error: any, message = "Er ging iets mis op de server.") {
  console.error(`taken ${where}`, error);
  return NextResponse.json({ error: `${message} (${error?.message || "onbekend"})` }, { status: 500 });
}

/** De datum die de browser meestuurt (lokale dag), anders vandaag in Nederland. */
export const dayFrom = (value: unknown) => (isIsoDate(value) ? value : amsterdamToday());

/** Dagplannen van de vijf dagen hiervoor, voor de balans tussen gebieden. */
export async function recentPlans(date: string) {
  const dates = [1, 2, 3, 4, 5].map((n) => addDays(date, -n));
  return (await getDays(dates)).filter(Boolean) as DayPlan[];
}

const sameIds = (a: { id: string }[], b: { id: string }[]) => a.length === b.length && a.every((p, i) => p.id === b[i].id);

/**
 * Houdt de top 3 bij: taken die weg zijn of naar wachten/ooit gingen vallen eruit,
 * lege plekken worden aangevuld zolang de dag niet is afgesloten. Afgevinkte taken blijven staan.
 *
 * - "achtergrond" (bij openen): alleen opslaan als het plan intussen niet elders is veranderd,
 *   en dan alleen de top 3 bijwerken, zodat bijv. een gelijktijdige dagafsluiting blijft staan.
 * - "actie" (wisselen, zelf kiezen): jouw keuze wint; velden van de afsluiting blijven behouden.
 */
export async function syncPlan(plan: DayPlan, tasks?: Task[], ctx: DayContext = {}, mode: "achtergrond" | "actie" = "achtergrond"): Promise<DayPlan> {
  const all = tasks || (await getTasks());
  const byId = new Map(all.map((t) => [t.id, t]));
  const keep = plan.top3.filter((p) => {
    const t = byId.get(p.id);
    return t && (OPEN_STATUSES.includes(t.status) || t.status === "af");
  });
  let top3 = keep;
  if (keep.length < 3 && !plan.closedAt) {
    const keptTasks = keep.map((p) => byId.get(p.id) as Task);
    const ranked = rankTasks(
      all,
      plan.date,
      await recentPlans(plan.date),
      [...plan.swapped, ...keep.map((p) => p.id)],
      ctx
    );
    const extra = pickTop(ranked, 3 - keep.length, keptTasks);
    top3 = [...keep, ...extra.map((s) => ({ id: s.task.id, reason: s.reason }))];
  }
  const areas = top3.map((p) => byId.get(p.id)?.areaId ?? null);
  const next: DayPlan = { ...plan, top3, areas };
  if (mode === "achtergrond") {
    if (sameIds(top3, plan.top3)) return next;
    const result = await mutateDay(plan.date, (current) =>
      current && sameIds(current.top3, plan.top3) && current.closedAt === plan.closedAt ? { ...current, top3, areas } : null
    );
    return result.changed ? (result.value as DayPlan) : result.value || next;
  }
  const result = await mutateDay(plan.date, (current) => ({ ...(current || plan), top3, areas, swapped: plan.swapped }));
  return result.value as DayPlan;
}

/** De top 3 van een dag: bij de eerste keer openen gekozen en daarna vastgehouden. */
export async function todayPlan(date: string, tasks?: Task[]): Promise<DayPlan> {
  const all = tasks || (await getTasks());
  const [existing] = await getDays([date]);
  if (existing && (existing.top3.length >= 3 || existing.closedAt)) return syncPlan(existing, all);
  const ctx = await dayContext(date, all);
  if (existing) return syncPlan(existing, all, ctx);
  const plan = makePlan(all, date, await recentPlans(date), ctx);
  // Alleen als er intussen geen plan is ontstaan (bijv. op een ander apparaat): dan geldt dat plan.
  return (await mutateDay(date, (current) => (current ? null : plan))).value || plan;
}

/** Vrije tijd van vandaag uit de agenda; mag nooit de top 3 blokkeren (max. 3 seconden). */
export async function dayContext(date: string, tasks: Task[]): Promise<DayContext> {
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    return { freeMinutes: await Promise.race([freeMinutesOn(date, tasks), timeout]) };
  } catch (error) {
    console.error("taken agenda", error);
    return {};
  }
}

/**
 * Een taak afvinken: bij een terugkerende taak komt de volgende keer meteen klaar te staan.
 * De afgevinkte taak verliest zijn herhaling, zodat opnieuw afvinken geen dubbele maakt.
 */
export function completeWithRepeat(task: Task, today: string, now = Date.now()): { done: Task; next: Task | null } {
  const next = spawnNext(task, today, now);
  return { done: next ? { ...task, repeat: null } : task, next };
}
