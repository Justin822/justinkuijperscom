import { AREA_BY_ID, AREAS, OPEN_STATUSES } from "./config";
import { diffDays, formatRelative } from "./dates";
import type { AreaId, DayPlan, Pick, Task } from "./types";

// Top 3 zonder AI: elke open taak krijgt punten, de reden is de zwaarste factor.

type Factor = { points: number; reason: string };
export type Scored = { task: Task; score: number; reason: string };

const BIG_TASK = 240; // halve dag of meer

/** Hoe vaak elk gebied de afgelopen dagen in de top 3 stond. */
export function areaHistory(recent: DayPlan[]) {
  const counts: Partial<Record<AreaId, number>> = {};
  let total = 0;
  for (const plan of recent) {
    for (const area of plan.areas) {
      if (!area) continue;
      counts[area] = (counts[area] || 0) + 1;
      total++;
    }
  }
  return { counts, total };
}

/** Extra context voor vandaag: hoeveel vrije werktijd je agenda nog laat. */
export type DayContext = { freeMinutes?: number | null };

export function scoreTask(
  task: Task,
  today: string,
  history: ReturnType<typeof areaHistory>,
  ctx: DayContext = {}
): Scored {
  const factors: Factor[] = [];
  const add = (points: number, reason: string) => factors.push({ points, reason });

  if (task.deadline) {
    const days = diffDays(today, task.deadline);
    const hard = task.deadlineHard;
    const when = formatRelative(task.deadline, today);
    if (days < 0) add(hard ? 100 : 40, `${hard ? "Harde deadline" : "Deadline"} was ${when}`);
    else if (days === 0) add(hard ? 90 : 35, `${hard ? "Harde deadline" : "Deadline"} vandaag`);
    else if (days === 1) add(hard ? 70 : 25, `${hard ? "Harde deadline" : "Deadline"} morgen`);
    else if (days === 2) add(hard ? 50 : 18, `${hard ? "Harde deadline" : "Deadline"} ${when}`);
    else if (days <= 5) add(hard ? 30 : 10, `${hard ? "Harde deadline" : "Deadline"} ${when}`);
    else if (days <= 10) add(hard ? 12 : 4, `Deadline ${when}`);
  }

  if (task.planDate) {
    const days = diffDays(today, task.planDate);
    if (days === 0) add(60, "Je had hem voor vandaag ingepland");
    else if (days < 0) add(40, `Stond ingepland voor ${formatRelative(task.planDate, today)}`);
    else add(-40, "");
  }

  if (task.blockStart?.startsWith(today)) add(50, `Ingepland om ${task.blockStart.slice(11, 16)}`);

  // Volle agenda: liever iets wat past dan een grote klus.
  if (ctx.freeMinutes != null && ctx.freeMinutes < 120) {
    if ((task.estimate || 0) >= 120) add(-25, "");
    else if (task.estimate && task.estimate <= 30) add(8, "Past in je volle dag");
  }

  if (task.impact === "hoog") add(30, "Hoge impact");
  else if (task.impact === "middel") add(12, "");
  else if (!task.impact) add(10, "");

  if (task.postponed > 0) add(Math.min(task.postponed, 4) * 12, `Al ${task.postponed}× doorgeschoven`);
  if (task.status === "bezig") add(10, "Je bent er al mee bezig");
  if (task.status === "inbox") add(-5, "");
  if (task.estimate && task.estimate <= 15) add(6, "Snel klaar");
  if (task.estimate && task.estimate >= BIG_TASK) add(-10, "");
  if (Date.now() - task.createdAt > 14 * 24 * 60 * 60 * 1000) add(5, "Staat al ruim twee weken open");

  // Balans tussen gebieden over de afgelopen dagen.
  if (task.areaId && history.total >= 6) {
    const count = history.counts[task.areaId] || 0;
    const name = AREA_BY_ID[task.areaId]?.name;
    if (count / history.total > 0.5) add(-15, "");
    else if (count === 0) add(8, `${name} kreeg de laatste dagen geen aandacht`);
  }

  const score = factors.reduce((sum, f) => sum + f.points, 0);
  const reasons = factors
    .filter((f) => f.reason && f.points > 0)
    .sort((a, b) => b.points - a.points)
    .map((f) => f.reason);
  const lowerFirst = (r: string) =>
    AREAS.some((a) => r.startsWith(a.name)) ? r : r.charAt(0).toLowerCase() + r.slice(1);
  const reason =
    reasons.length > 1
      ? `${reasons[0]}, en ${lowerFirst(reasons[1])}`
      : reasons[0] || "Goede kandidaat voor vandaag";
  return { task, score, reason };
}

/** Taken die vandaag in aanmerking komen, hoogste score eerst. */
export function rankTasks(
  tasks: Task[],
  today: string,
  recent: DayPlan[],
  exclude: string[] = [],
  ctx: DayContext = {}
): Scored[] {
  const history = areaHistory(recent);
  return tasks
    .filter((t) => OPEN_STATUSES.includes(t.status) && !exclude.includes(t.id))
    .map((t) => scoreTask(t, today, history, ctx))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.task.deadline || "9999").localeCompare(b.task.deadline || "9999") ||
        a.task.createdAt - b.task.createdAt
    );
}

/** Kiest de top 3: hoogste scores, maximaal één grote taak (halve dag of meer). */
export function pickTop(ranked: Scored[], count: number, already: Task[] = []): Scored[] {
  const picked: Scored[] = [];
  let big = already.filter((t) => (t.estimate || 0) >= BIG_TASK).length;
  for (const s of ranked) {
    if (picked.length >= count) break;
    const isBig = (s.task.estimate || 0) >= BIG_TASK;
    if (isBig && big >= 1) continue;
    if (isBig) big++;
    picked.push(s);
  }
  return picked;
}

export function makePlan(tasks: Task[], today: string, recent: DayPlan[], ctx: DayContext = {}): DayPlan {
  const top = pickTop(rankTasks(tasks, today, recent, [], ctx), 3);
  return {
    date: today,
    top3: top.map((s): Pick => ({ id: s.task.id, reason: s.reason })),
    swapped: [],
    areas: top.map((s) => s.task.areaId),
    closedAt: null,
  };
}
