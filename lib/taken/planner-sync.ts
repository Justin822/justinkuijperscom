import { addDays } from "./dates";
import { plannerItem, plannerItems, type PlannerItem } from "./google";
import { DEFAULT_TZ, utcToZoned, zonedToUtc } from "./ics";
import { getTasks, saveTasks } from "./store";
import type { Task } from "./types";
import { applyPatch } from "./validate";

// Tweezijdig: verplaats, rek op of verwijder je een timeblock in Google Agenda (bijv. op je telefoon),
// dan volgt de taak in de app. Wat de app zelf als laatste schreef, wint van oudere wijzigingen in Google.

/** Wat er aan een taak verandert door zijn timeblock in Google; null = niets. `item` null = weg uit Google. */
export function fromPlanner(task: Task, item: PlannerItem | null, tz = DEFAULT_TZ): Partial<Task> | null {
  if (!item || item.cancelled) {
    // In Google verwijderd: het blok gaat uit de taak, de taak zelf blijft.
    return task.blockStart || task.googleEventId ? { blockStart: null, googleEventId: null } : null;
  }
  // Alleen wijzigingen ná de laatste keer dat de app het blok naar Google schreef
  // (googleSyncedAt wordt pas gezet als Google het schrijven al heeft bevestigd).
  if (item.updated <= (task.googleSyncedAt ?? task.updatedAt)) return null;

  const next: Partial<Task> = {};
  if (item.start !== null && item.end !== null) {
    const z = utcToZoned(item.start, tz);
    const blockStart = `${z.date}T${z.time.slice(0, 5)}`;
    const estimate = Math.max(5, Math.min(1440, Math.round((item.end - item.start) / 60000)));
    if (blockStart !== task.blockStart) {
      next.blockStart = blockStart;
      if (task.planDate !== z.date) next.planDate = z.date;
    }
    if (estimate !== (task.estimate || 30)) next.estimate = estimate;
  } else if (item.date) {
    // In Google een hele-dag-afspraak van gemaakt: gepland op die dag, zonder tijd.
    if (task.blockStart) next.blockStart = null;
    if (task.planDate !== item.date) next.planDate = item.date;
  }
  const title = item.title.replace(/^✓\s*/, "").trim().slice(0, 300);
  if (title && title !== task.title) next.title = title;
  return Object.keys(next).length ? next : null;
}

/**
 * Leest de timeblocks in de agenda Planner rond deze dagen en werkt taken bij die in Google zijn veranderd.
 * Geeft de bijgewerkte taken terug (voor de browser).
 */
export async function syncFromPlanner(fromDate: string, toDate: string): Promise<Task[]> {
  const from = zonedToUtc(fromDate, "00:00", DEFAULT_TZ) - 14 * 3600000;
  const to = zonedToUtc(addDays(toDate, 1), "00:00", DEFAULT_TZ) + 14 * 3600000;
  const items = await plannerItems(from, to);
  if (!items) return [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const tasks = await getTasks();
  const now = Date.now();
  const changed: Task[] = [];
  const apply = (task: Task, item: PlannerItem | null) => {
    const patch = fromPlanner(task, item);
    if (patch) changed.push({ ...applyPatch(task, patch, now), googleSyncedAt: now });
  };

  const missing: Task[] = [];
  for (const task of tasks) {
    if (!task.googleEventId) continue;
    const item = byId.get(task.googleEventId);
    if (item) apply(task, item);
    else if (task.blockStart && task.blockStart.slice(0, 10) >= fromDate && task.blockStart.slice(0, 10) <= toDate) missing.push(task);
  }
  // Blokken die in deze dagen horen maar er in Google niet (meer) staan: verplaatst of verwijderd.
  await Promise.all(
    missing.slice(0, 10).map(async (task) => apply(task, await plannerItem(task.googleEventId as string)))
  );

  if (changed.length) await saveTasks(changed);
  return changed;
}
