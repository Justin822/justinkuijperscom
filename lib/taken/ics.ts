import { addDays, diffDays, makeDate, weekday } from "./dates";
import type { CalendarEvent } from "./types";

// Kleine iCal-parser (RFC 5545), genoeg voor de geheime agenda-links van Google en Outlook:
// tijdzones, hele dagen, herhalingen (RRULE) met uitzonderingen (EXDATE, RECURRENCE-ID).

export const DEFAULT_TZ = "Europe/Amsterdam";

// Outlook gebruikt soms Windows-namen voor tijdzones.
const WINDOWS_TZ: Record<string, string> = {
  "W. Europe Standard Time": "Europe/Amsterdam",
  "Romance Standard Time": "Europe/Paris",
  "Central Europe Standard Time": "Europe/Budapest",
  "GMT Standard Time": "Europe/London",
  "UTC": "UTC",
  "Coordinated Universal Time": "UTC",
  "Eastern Standard Time": "America/New_York",
  "Pacific Standard Time": "America/Los_Angeles",
};

function validTz(tz: string | undefined): string {
  const name = (tz && (WINDOWS_TZ[tz] || tz.replace(/^\/+/, ""))) || DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return name;
  } catch {
    return DEFAULT_TZ;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function tzParts(ms: number, tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(ms))) if (part.type !== "literal") p[part.type] = Number(part.value);
  return p;
}

/** Wandkloktijd in een tijdzone → tijdstip (ms). Werkt ook rond de overgang naar zomer-/wintertijd. */
export function zonedToUtc(date: string, time: string, tz: string = DEFAULT_TZ): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h = 0, mi = 0, s = 0] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi, s);
  const offsetAt = (ms: number) => {
    const p = tzParts(ms, tz);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
  };
  let utc = wall - offsetAt(wall);
  utc = wall - offsetAt(utc);
  return utc;
}

/** Tijdstip → lokale datum en tijd in een tijdzone. */
export function utcToZoned(ms: number, tz: string = DEFAULT_TZ) {
  const p = tzParts(ms, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}` };
}

type Prop = { name: string; params: Record<string, string>; value: string };

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseLine(line: string): Prop | null {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (colon < 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescape = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

/** Een datum/tijd uit de agenda: hele dag (alleen datum) of lokale tijd + tijdzone. */
type When = { date: string; time: string | null; tz: string };

function parseWhen(prop: Prop): When | null {
  const m = prop.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4] || prop.params.VALUE === "DATE") return { date, time: null, tz: "UTC" };
  return { date, time: `${m[4]}:${m[5]}:${m[6] || "00"}`, tz: m[7] ? "UTC" : validTz(prop.params.TZID) };
}

const whenMs = (w: When) => (w.time ? zonedToUtc(w.date, w.time, w.tz) : Date.parse(`${w.date}T00:00:00Z`));

function parseDuration(value: string): number {
  const m = value.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const [, sign, w, d, h, mi, s] = m;
  const ms = ((+w || 0) * 7 * 86400 + (+d || 0) * 86400 + (+h || 0) * 3600 + (+mi || 0) * 60 + (+s || 0)) * 1000;
  return sign === "-" ? -ms : ms;
}

type Raw = {
  uid: string;
  title: string;
  location: string | null;
  start: When;
  /** Duur in ms (bij hele dagen in hele dagen × 24 uur). */
  duration: number;
  rrule: Record<string, string> | null;
  exdates: Set<number>;
  recurrenceId: number | null;
  cancelled: boolean;
  busy: boolean;
};

export function parseIcs(text: string): Raw[] {
  const events: Raw[] = [];
  let props: Prop[] | null = null;
  let depth = 0; // VALARM e.d. binnen een VEVENT overslaan
  for (const line of unfold(text)) {
    if (/^BEGIN:VEVENT/i.test(line)) {
      props = [];
      depth = 0;
      continue;
    }
    if (!props) continue;
    if (/^BEGIN:/i.test(line)) {
      depth++;
      continue;
    }
    if (/^END:/i.test(line) && depth > 0) {
      depth--;
      continue;
    }
    if (/^END:VEVENT/i.test(line)) {
      const event = toRaw(props);
      if (event) events.push(event);
      props = null;
      continue;
    }
    if (depth === 0) {
      const prop = parseLine(line);
      if (prop) props.push(prop);
    }
  }
  return events;
}

function toRaw(props: Prop[]): Raw | null {
  const get = (name: string) => props.find((p) => p.name === name);
  const startProp = get("DTSTART");
  const start = startProp && parseWhen(startProp);
  if (!start) return null;
  const endProp = get("DTEND");
  const end = endProp && parseWhen(endProp);
  const durationProp = get("DURATION");
  let duration = start.time ? 0 : 86400000;
  if (end) duration = whenMs(end) - whenMs(start);
  else if (durationProp) duration = parseDuration(durationProp.value);
  const exdates = new Set<number>();
  for (const p of props.filter((p) => p.name === "EXDATE")) {
    for (const value of p.value.split(",")) {
      const w = parseWhen({ ...p, value });
      if (w) exdates.add(w.time || !start.time ? whenMs(w) : whenMs({ ...start, date: w.date }));
    }
  }
  const rruleProp = get("RRULE");
  const recurrenceProp = get("RECURRENCE-ID");
  const recurrence = recurrenceProp && parseWhen(recurrenceProp);
  return {
    uid: get("UID")?.value || `${start.date}-${get("SUMMARY")?.value || ""}`,
    title: unescape(get("SUMMARY")?.value || "(geen titel)"),
    location: get("LOCATION") ? unescape(get("LOCATION")!.value) || null : null,
    start,
    duration: Math.max(0, duration),
    rrule: rruleProp
      ? Object.fromEntries(rruleProp.value.split(";").map((kv) => kv.split("=") as [string, string]).map(([k, v]) => [k.toUpperCase(), v]))
      : null,
    exdates,
    recurrenceId: recurrence ? whenMs(recurrence) : null,
    cancelled: /CANCELLED/i.test(get("STATUS")?.value || ""),
    busy: !/TRANSPARENT/i.test(get("TRANSP")?.value || ""),
  };
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MAX_STEPS = 20000;

/** Startdatums (lokale datum in de tijdzone van het event) van alle herhalingen tot `untilDate`. */
function occurrenceDates(event: Raw, untilDate: string): string[] {
  const rule = event.rrule as Record<string, string>;
  const freq = rule.FREQ;
  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const count = rule.COUNT ? Number(rule.COUNT) : Infinity;
  let until = untilDate;
  if (rule.UNTIL) {
    const w = parseWhen({ name: "UNTIL", params: {}, value: rule.UNTIL });
    if (w) {
      const local = w.time && event.start.time ? utcToZoned(whenMs(w), event.start.tz).date : w.date;
      if (local < until) until = local;
    }
  }
  const startDate = event.start.date;
  const byDay = (rule.BYDAY || "").split(",").filter(Boolean);
  const byMonthDay = (rule.BYMONTHDAY || "").split(",").filter(Boolean).map(Number);
  const dates: string[] = [];
  const push = (date: string) => {
    if (date < startDate || date > until || dates.length >= count) return false;
    dates.push(date);
    return true;
  };

  if (freq === "DAILY") {
    for (let i = 0, d = startDate; d <= until && dates.length < count && i < MAX_STEPS; i++, d = addDays(d, interval)) {
      if (!byDay.length || byDay.includes(DAY_CODES[weekday(d)])) push(d);
    }
  } else if (freq === "WEEKLY") {
    const days = byDay.length ? byDay.map((c) => DAY_CODES.indexOf(c.slice(-2))) : [weekday(startDate)];
    // Weken beginnen op maandag (WKST=MO).
    const weekStart = addDays(startDate, -((weekday(startDate) + 6) % 7));
    for (let i = 0, w = weekStart; w <= until && dates.length < count && i < MAX_STEPS; i++, w = addDays(w, 7 * interval)) {
      const inWeek = days.map((d) => addDays(w, (d + 6) % 7)).sort();
      for (const d of inWeek) push(d);
    }
  } else if (freq === "MONTHLY" || freq === "YEARLY") {
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const step = freq === "MONTHLY" ? interval : 12 * interval;
    for (let i = 0; dates.length < count && i < MAX_STEPS; i += step) {
      const year = sy + Math.floor((sm - 1 + i) / 12);
      const month = ((sm - 1 + i) % 12) + 1;
      const first = makeDate(year, month, 1) as string;
      if (first > until) break;
      const candidates: string[] = [];
      if (byDay.length) {
        // "2TU" = tweede dinsdag, "-1FR" = laatste vrijdag
        const nextFirst = makeDate(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1) as string;
        const daysInMonth = diffDays(first, nextFirst);
        for (const code of byDay) {
          const n = parseInt(code, 10);
          const wd = DAY_CODES.indexOf(code.slice(-2));
          const matches: string[] = [];
          for (let d = 0; d < daysInMonth; d++) if (weekday(addDays(first, d)) === wd) matches.push(addDays(first, d));
          if (isNaN(n)) candidates.push(...matches);
          else if (n > 0 && matches[n - 1]) candidates.push(matches[n - 1]);
          else if (n < 0 && matches[matches.length + n]) candidates.push(matches[matches.length + n]);
        }
      } else {
        for (const day of byMonthDay.length ? byMonthDay : [sd]) {
          const date = makeDate(year, month, day);
          if (date) candidates.push(date);
        }
      }
      for (const d of candidates.sort()) push(d);
    }
  } else {
    push(startDate);
  }
  return dates;
}

/** Alle afspraken die (deels) in het venster [from, to) vallen, als tijdstippen. */
export function expandEvents(raws: Raw[], from: number, to: number, calendar: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const overrides = new Map<string, Set<number>>();
  for (const r of raws) {
    if (r.recurrenceId === null) continue;
    if (!overrides.has(r.uid)) overrides.set(r.uid, new Set());
    overrides.get(r.uid)!.add(r.recurrenceId);
  }

  const add = (r: Raw, startMs: number, date: string) => {
    const endMs = startMs + r.duration;
    if (r.cancelled || endMs <= from || startMs >= to) return;
    const allDay = !r.start.time;
    const days = Math.max(1, Math.round(r.duration / 86400000));
    out.push({
      id: `${calendar}:${r.uid}:${startMs}`,
      calendar,
      title: r.title,
      location: r.location,
      allDay,
      start: startMs,
      end: allDay ? startMs + days * 86400000 : endMs,
      startDate: allDay ? date : null,
      endDate: allDay ? addDays(date, days) : null,
      busy: r.busy && !allDay,
    });
  };

  const untilDate = new Date(to + 86400000).toISOString().slice(0, 10);
  for (const r of raws) {
    if (!r.rrule || r.recurrenceId !== null) {
      add(r, whenMs(r.start), r.start.date);
      continue;
    }
    const skip = overrides.get(r.uid);
    for (const date of occurrenceDates(r, untilDate)) {
      const startMs = whenMs({ ...r.start, date });
      if (r.exdates.has(startMs) || skip?.has(startMs)) continue;
      add(r, startMs, date);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
