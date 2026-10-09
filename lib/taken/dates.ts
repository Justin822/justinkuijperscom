// Datums als "YYYY-MM-DD"-strings, gerekend in UTC zodat tijdzones niet meespelen.

const DAY = 24 * 60 * 60 * 1000;

export const WEEKDAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
export const WEEKDAYS_SHORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];
export const MONTHS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

export const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso: string, days: number) => fromMs(toMs(iso) + days * DAY);
export const diffDays = (from: string, to: string) => Math.round((toMs(to) - toMs(from)) / DAY);
export const weekday = (iso: string) => new Date(toMs(iso)).getUTCDay();

export function makeDate(year: number, month: number, day: number): string | null {
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return fromMs(ms);
}

/** De lokale dag (tijdzone van de browser) van een tijdstip; standaard vandaag. */
export function localToday(ms: number = Date.now()): string {
  const d = new Date(ms);
  return makeDate(d.getFullYear(), d.getMonth() + 1, d.getDate()) as string;
}

/** Vandaag in Nederland (voor de server, die in UTC draait). */
export function amsterdamToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

/** Eerstvolgende dag met deze weekdag (0 = zondag); vandaag telt mee. */
export function nextWeekday(today: string, day: number) {
  return addDays(today, (day - weekday(today) + 7) % 7);
}

export function formatLong(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${WEEKDAYS[weekday(iso)]} ${d} ${MONTHS[m - 1]}`;
}

/** "vandaag", "morgen", "vr 16 okt", "3 dagen te laat". */
export function formatRelative(iso: string, today: string) {
  const diff = diffDays(today, iso);
  if (diff === 0) return "vandaag";
  if (diff === 1) return "morgen";
  if (diff === -1) return "gisteren";
  const [y, m, d] = iso.split("-").map(Number);
  const short = `${WEEKDAYS_SHORT[weekday(iso)]} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
  return y === Number(today.slice(0, 4)) ? short : `${short} ${y}`;
}
