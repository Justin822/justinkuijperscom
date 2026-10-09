import { NextResponse } from "next/server";
import { OPEN_STATUSES } from "./config";
import { addDays, amsterdamToday, isIsoDate } from "./dates";
import { pickTop, rankTasks } from "./score";
import { getDays, getTasks, saveDay } from "./store";
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

/**
 * Houdt de top 3 bij: taken die weg zijn of naar wachten/ooit gingen vallen eruit,
 * lege plekken worden aangevuld zolang de dag niet is afgesloten. Afgevinkte taken blijven staan.
 */
export async function syncPlan(plan: DayPlan, tasks?: Task[]): Promise<DayPlan> {
  const all = tasks || (await getTasks());
  const byId = new Map(all.map((t) => [t.id, t]));
  const keep = plan.top3.filter((p) => {
    const t = byId.get(p.id);
    return t && (OPEN_STATUSES.includes(t.status) || t.status === "af");
  });
  let top3 = keep;
  if (keep.length < 3 && !plan.closedAt) {
    const keptTasks = keep.map((p) => byId.get(p.id) as Task);
    const ranked = rankTasks(all, plan.date, await recentPlans(plan.date), [
      ...plan.swapped,
      ...keep.map((p) => p.id),
    ]);
    const extra = pickTop(ranked, 3 - keep.length, keptTasks);
    top3 = [...keep, ...extra.map((s) => ({ id: s.task.id, reason: s.reason }))];
  }
  const changed = top3.length !== plan.top3.length || top3.some((p, i) => p.id !== plan.top3[i]?.id);
  const next: DayPlan = { ...plan, top3, areas: top3.map((p) => byId.get(p.id)?.areaId ?? null) };
  if (changed) await saveDay(next);
  return next;
}
