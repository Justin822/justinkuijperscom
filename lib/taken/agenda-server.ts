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

/**
 * Alleen publieke https-adressen: de server haalt deze link zelf op, dus geen localhost,
 * interne netwerken of IP-adressen in privé-reeksen.
 */
export function isPublicHttpsUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !host.includes(":")) return false;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return false;
  }
  if (host.includes(":")) {
    // IPv6: loopback, link-local, unique local en IPv4-mapped weigeren.
    if (host === "::1" || host === "::" || /^(fe80|fc|fd)/.test(host) || host.startsWith("::ffff:")) return false;
  }
  return true;
}

async function loadIcs(source: Pick<IcsSource, "name" | "url">, fresh = false) {
  const hit = icsCache.get(source.url);
  if (!fresh && hit && Date.now() - hit.at < TTL) return hit.raws;
  // Tijdslimiet, zodat een trage agenda-link de app niet laat hangen.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  let text: string;
  try {
    const res = await fetch(source.url, { cache: "no-store", headers: { Accept: "text/calendar" }, signal: controller.signal });
    if (!res.ok) throw new Error(`${source.name}: ${res.status === 404 ? "link niet gevonden" : `fout ${res.status}`}`);
    text = await res.text();
  } catch (error: any) {
    if (controller.signal.aborted) throw new Error(`${source.name}: geen antwoord binnen 7 s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
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

/** Afspraken tussen twee lokale datums (inclusief), plus foutmeldingen per agenda. `fresh`: Google niet uit de cache. */
export async function getEvents(fromDate: string, toDate: string, fresh = false) {
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
    settings.google ? googleEvents(from, to, fresh) : Promise.resolve({ events: [], errors: [] }),
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
