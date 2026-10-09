import { blockInterval, freeMinutes } from "./agenda";
import { addDays } from "./dates";
import { googleEvents } from "./google";
import { DEFAULT_TZ, expandEvents, parseIcs, zonedToUtc } from "./ics";
import { getSettings } from "./store";
import type { CalendarEvent, IcsSource, Task } from "./types";

// Afspraken ophalen: iCal-links (bijv. Outlook) en de gekoppelde Google-agenda's. Alleen op de server.

const icsCache = new Map<string, { at: number; raws: ReturnType<typeof parseIcs> }>();
const TTL = 5 * 60 * 1000;
export const clearIcsCache = () => icsCache.clear();

export const normalizeIcsUrl = (url: string) => url.trim().replace(/^webcal:\/\//i, "https://");

async function loadIcs(source: Pick<IcsSource, "name" | "url">, fresh = false) {
  const hit = icsCache.get(source.url);
  if (!fresh && hit && Date.now() - hit.at < TTL) return hit.raws;
  const res = await fetch(source.url, { cache: "no-store", headers: { Accept: "text/calendar" } });
  if (!res.ok) throw new Error(`${source.name}: ${res.status === 404 ? "link niet gevonden" : `fout ${res.status}`}`);
  const text = await res.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error(`${source.name}: dit is geen agenda-link (iCal)`);
  const raws = parseIcs(text);
  icsCache.set(source.url, { at: Date.now(), raws });
  return raws;
}

/** Test een nieuwe iCal-link: hoeveel afspraken staan er de komende 30 dagen in? */
export async function testIcs(name: string, url: string) {
  const raws = await loadIcs({ name, url }, true);
  const now = Date.now();
  return expandEvents(raws, now, now + 30 * 86400000, name).length;
}

/** Afspraken tussen twee lokale datums (inclusief), plus foutmeldingen per agenda. */
export async function getEvents(fromDate: string, toDate: string) {
  const settings = await getSettings();
  // Ruim venster in UTC; de browser filtert per lokale dag.
  const from = zonedToUtc(fromDate, "00:00", DEFAULT_TZ) - 14 * 3600000;
  const to = zonedToUtc(addDays(toDate, 1), "00:00", DEFAULT_TZ) + 14 * 3600000;
  const errors: string[] = [];
  const [ics, google] = await Promise.all([
    Promise.all(
      settings.icsSources.map(async (s) => {
        try {
          return expandEvents(await loadIcs(s), from, to, s.name);
        } catch (error: any) {
          errors.push(error?.message || s.name);
          return [] as CalendarEvent[];
        }
      })
    ),
    settings.google ? googleEvents(from, to) : Promise.resolve({ events: [], errors: [] }),
  ]);
  errors.push(...google.errors);
  return {
    configured: settings.icsSources.length > 0 || Boolean(settings.google),
    events: [...ics.flat(), ...google.events].sort((a, b) => a.start - b.start),
    errors,
  };
}

/** Vrije werktijd op een dag (tijdzone Nederland), of null zonder gekoppelde agenda. */
export async function freeMinutesOn(date: string, tasks: Task[]): Promise<number | null> {
  const settings = await getSettings();
  if (!settings.icsSources.length && !settings.google) return null;
  const { events } = await getEvents(date, date);
  const toMs = (d: string, t: string) => zonedToUtc(d, t, DEFAULT_TZ);
  const busy: [number, number][] = events.filter((e) => e.busy).map((e) => [e.start, e.end]);
  for (const t of tasks) {
    if (t.status === "af" || !t.blockStart?.startsWith(date)) continue;
    const interval = blockInterval(t, toMs);
    if (interval) busy.push(interval);
  }
  return freeMinutes(busy, toMs(date, settings.workday.start), toMs(date, settings.workday.end));
}
