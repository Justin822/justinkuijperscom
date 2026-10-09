import type { Task } from "./types";

// Rekenhulpjes voor de agenda, bruikbaar in de browser én op de server.
// Het ophalen van afspraken (iCal en Google) staat in agenda-server.ts.

/** Standaard werkdag; je eigen tijden staan in de instellingen. */
export const WORKDAY = { start: "09:00", end: "17:30" };

export type Interval = [number, number];

/** Tijdstip-venster van een timeblock; op de server met een omrekening naar Nederlandse tijd. */
export function blockInterval(task: Task, toMs?: (date: string, time: string) => number): Interval | null {
  if (!task.blockStart) return null;
  const [date, time] = task.blockStart.split("T");
  const start = toMs ? toMs(date, time) : new Date(`${date}T${time}:00`).getTime();
  return [start, start + (task.estimate || 30) * 60000];
}

/** Vrije minuten binnen [dayStart, dayEnd), na aftrek van bezette afspraken en timeblocks. */
export function freeMinutes(busy: Interval[], dayStart: number, dayEnd: number, from = dayStart): number {
  const start = Math.max(dayStart, from);
  if (start >= dayEnd) return 0;
  const clipped = busy
    .map(([a, b]) => [Math.max(a, start), Math.min(b, dayEnd)] as Interval)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let taken = 0;
  let cursor = start;
  for (const [a, b] of clipped) {
    if (b <= cursor) continue;
    taken += b - Math.max(a, cursor);
    cursor = Math.max(cursor, b);
  }
  return Math.round((dayEnd - start - taken) / 60000);
}

/** Eerste vrije plek van `duration` ms tussen `from` en `until`, op hele kwartieren; null als het niet past. */
export function firstFreeSlot(busy: Interval[], from: number, until: number, duration: number): number | null {
  const quarter = 15 * 60000;
  let cursor = Math.ceil(from / quarter) * quarter;
  const sorted = busy.filter(([a, b]) => b > from && a < until).sort((x, y) => x[0] - y[0]);
  for (const [a, b] of sorted) {
    if (a - cursor >= duration) break;
    if (b > cursor) cursor = Math.ceil(b / quarter) * quarter;
  }
  return cursor + duration <= until ? cursor : null;
}
