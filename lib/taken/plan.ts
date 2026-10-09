import { firstFreeSlot, type Interval } from "./agenda";

// "Plan mijn dag": zet taken op volgorde van belang in de eerste vrije plekken van je werkdag.

export type Placement = { taskId: string; start: number; end: number };

export function autoSchedule(
  tasks: { id: string; estimate: number | null }[],
  busy: Interval[],
  from: number,
  until: number,
  options: { gap?: number; defaultMinutes?: number } = {}
): Placement[] {
  const gap = (options.gap ?? 0) * 60000;
  const taken: Interval[] = [...busy];
  const placements: Placement[] = [];
  for (const task of tasks) {
    const duration = (task.estimate || options.defaultMinutes || 30) * 60000;
    const start = firstFreeSlot(taken, from, until, duration);
    if (start === null) continue; // past niet meer; kleinere taken verderop misschien wel
    placements.push({ taskId: task.id, start, end: start + duration });
    taken.push([start, start + duration + gap]);
  }
  return placements;
}
