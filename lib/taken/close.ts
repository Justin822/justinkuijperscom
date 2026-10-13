import { addDays } from "./dates";
import type { DayPlan, Task } from "./types";
import { applyPatch } from "./validate";

// Dagafsluiting: wat vandaag niet af kwam schuift door naar morgen (teller +1).
// Nogmaals afsluiten (bijv. na nog wat werk) schuift dezelfde taken niet opnieuw door.

export const emptyPlan = (date: string): DayPlan => ({ date, top3: [], swapped: [], areas: [], closedAt: null });

/** Eén taak doorschuiven naar de dag na `date`; null als hij al af is. */
export function postponeTask(task: Task, date: string, now = Date.now()): Task | null {
  if (task.status === "af") return null;
  const patch: Partial<Task> = { postponed: task.postponed + 1 };
  if (task.planDate && task.planDate <= date) patch.planDate = addDays(date, 1);
  // Een timeblock van vandaag (of eerder) klopt niet meer: de taak gaat zonder tijd naar morgen.
  if (task.blockStart && task.blockStart.slice(0, 10) <= date) patch.blockStart = null;
  return applyPatch(task, patch, now);
}

/**
 * Legt in het dagplan vast welke taken vandaag worden doorgeschoven. Alleen taken die er nog niet
 * in stonden komen terug als `claimed`; zo telt een tweede afsluiting (ook een gelijktijdige) niet dubbel.
 */
export function claimPostpones(plan: DayPlan | null, date: string, ids: string[]): { plan: DayPlan; claimed: string[] } {
  const base = plan || emptyPlan(date);
  const already = new Set(base.postponed || []);
  const claimed = Array.from(new Set(ids)).filter((id) => !already.has(id));
  return { plan: { ...base, postponed: [...Array.from(already), ...claimed] }, claimed };
}

/** Alles in één keer, zonder opslag (voor tests en uitleg); de route doet dezelfde stappen met compare-and-set. */
export function closeDay(
  tasks: Task[],
  plan: DayPlan | null,
  date: string,
  postpone: string[],
  now = Date.now()
): { changed: Task[]; plan: DayPlan } {
  const claim = claimPostpones(plan, date, postpone);
  const wanted = new Set(claim.claimed);
  const changed = tasks.filter((t) => wanted.has(t.id)).map((t) => postponeTask(t, date, now)).filter(Boolean) as Task[];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const t of changed) byId.set(t.id, t);
  const inboxAtClose = Array.from(byId.values()).filter((t) => t.status === "inbox").length;
  return { changed, plan: { ...claim.plan, closedAt: now, inboxAtClose } };
}
