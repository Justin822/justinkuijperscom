import { addDays } from "./dates";
import { DEFAULT_TZ, expandEvents, parseIcs, zonedToUtc } from "./ics";
import type { CalendarEvent, Task } from "./types";

// Agenda's ophalen via hun geheime iCal-link (AGENDA_ICS_URLS), alleen lezen.

export const WORKDAY = { start: "09:00", end: "17:30" };

type Source = { name: string; url: string };

export function agendaSources(): Source[] {
  return (process.env.AGENDA_ICS_URLS || "")
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry, i) => {
      const bar = entry.indexOf("|");
      const name = bar > 0 ? entry.slice(0, bar).trim() : `Agenda ${i + 1}`;
      const url = (bar > 0 ? entry.slice(bar + 1) : entry).trim().replace(/^webcal:\/\//i, "https://");
      return { name, url };
    })
    .filter((s) => /^https?:\/\//i.test(s.url));
}

const cache = new Map<string, { at: number; raws: ReturnType<typeof parseIcs> }>();
const TTL = 5 * 60 * 1000;

async function load(source: Source) {
  const hit = cache.get(source.url);
  if (hit && Date.now() - hit.at < TTL) return hit.raws;
  const res = await fetch(source.url, { cache: "no-store", headers: { Accept: "text/calendar" } });
  if (!res.ok) throw new Error(`${source.name}: ${res.status}`);
  const raws = parseIcs(await res.text());
  cache.set(source.url, { at: Date.now(), raws });
  return raws;
}

/** Afspraken tussen twee lokale datums (inclusief), plus foutmeldingen per agenda. */
export async function getEvents(fromDate: string, toDate: string) {
  const sources = agendaSources();
  // Ruim venster in UTC; de browser filtert per lokale dag.
  const from = zonedToUtc(fromDate, "00:00", DEFAULT_TZ) - 14 * 3600000;
  const to = zonedToUtc(addDays(toDate, 1), "00:00", DEFAULT_TZ) + 14 * 3600000;
  const errors: string[] = [];
  const results = await Promise.all(
    sources.map(async (s) => {
      try {
        return expandEvents(await load(s), from, to, s.name);
      } catch (error: any) {
        errors.push(error?.message || s.name);
        return [] as CalendarEvent[];
      }
    })
  );
  return {
    configured: sources.length > 0,
    events: results.flat().sort((a, b) => a.start - b.start),
    errors,
  };
}

type Interval = [number, number];

/** Tijdstip-venster van een timeblock; tz alleen nodig op de server. */
export function blockInterval(task: Task, tz?: string): Interval | null {
  if (!task.blockStart) return null;
  const [date, time] = task.blockStart.split("T");
  const start = tz ? zonedToUtc(date, time, tz) : new Date(`${date}T${time}:00`).getTime();
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

/** Vrije werktijd op een dag (server, tijdzone Nederland). */
export async function freeMinutesOn(date: string, tasks: Task[]): Promise<number | null> {
  if (!agendaSources().length) return null;
  const { events } = await getEvents(date, date);
  const busy: Interval[] = events.filter((e) => e.busy).map((e) => [e.start, e.end]);
  for (const t of tasks) {
    if (t.status === "af" || !t.blockStart?.startsWith(date)) continue;
    const interval = blockInterval(t, DEFAULT_TZ);
    if (interval) busy.push(interval);
  }
  return freeMinutes(
    busy,
    zonedToUtc(date, WORKDAY.start, DEFAULT_TZ),
    zonedToUtc(date, WORKDAY.end, DEFAULT_TZ)
  );
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
