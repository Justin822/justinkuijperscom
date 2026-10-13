import { addDays } from "./dates";
import type { DayPlan, Task } from "./types";
import { applyPatch } from "./validate";

// Dagafsluiting: wat vandaag niet af kwam schuift door naar morgen (teller +1).
// Nogmaals afsluiten (bijv. na nog wat werk) schuift dezelfde taken niet opnieuw door.

export function closeDay(
  tasks: Task[],
  plan: DayPlan | null,
  date: string,
  postpone: string[],
  now = Date.now()
): { changed: Task[]; plan: DayPlan } {
  const tomorrow = addDays(date, 1);
  const already = new Set(plan?.postponed || []);
  const wanted = new Set(postpone);
  const changed: Task[] = [];

  for (const task of tasks) {
    if (!wanted.has(task.id) || already.has(task.id) || task.status === "af") continue;
    const patch: Partial<Task> = { postponed: task.postponed + 1 };
    if (task.planDate && task.planDate <= date) patch.planDate = tomorrow;
    // Een timeblock van vandaag (of eerder) klopt niet meer: de taak gaat zonder tijd naar morgen.
    if (task.blockStart && task.blockStart.slice(0, 10) <= date) patch.blockStart = null;
    changed.push(applyPatch(task, patch, now));
    already.add(task.id);
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const t of changed) byId.set(t.id, t);
  const inboxAtClose = Array.from(byId.values()).filter((t) => t.status === "inbox").length;
  const base: DayPlan = plan || { date, top3: [], swapped: [], areas: [], closedAt: null };
  return { changed, plan: { ...base, closedAt: now, inboxAtClose, postponed: Array.from(already) } };
}
