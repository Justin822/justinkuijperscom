// Rekenen met tijden in de agenda: alles in minuten vanaf middernacht (lokale wandkloktijd),
// zodat zomer-/wintertijd geen verschuivingen geeft.

export const DAY_MINUTES = 24 * 60;
export const SNAP = 15;

export const pad = (n: number) => String(n).padStart(2, "0");

/** "HH:MM" → minuten. */
export const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Minuten → "HH:MM" (24:00 blijft 24:00). */
export const fmt = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(Math.round(minutes % 60))}`;

export const snap = (minutes: number, step = SNAP) => Math.round(minutes / step) * step;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Pixels in het rooster → minuten. */
export const pxToMinutes = (px: number, hourHeight: number) => (px / hourHeight) * 60;
export const minutesToPx = (minutes: number, hourHeight: number) => (minutes / 60) * hourHeight;

/** Lokale datum en minuut van een tijdstip. */
export function localParts(ms: number) {
  const d = new Date(ms);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    minutes: d.getHours() * 60 + d.getMinutes(),
  };
}

/** Lokale wandkloktijd → tijdstip (ms). Minuten mogen over 24:00 heen lopen. */
export function localMs(date: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 0, minutes).getTime();
}

/** "YYYY-MM-DDTHH:mm" voor een timeblock. */
export const blockStartOf = (date: string, minutes: number) => `${date}T${fmt(minutes)}`;

/** Duur als tekst: "30 min", "1u", "1u 30m". */
export function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}u ${m}m` : `${h}u`;
}

/**
 * Een verplaatsing of oprekking begrenzen: niet voor 00:00, niet na 24:00, minimaal één stap lang.
 * Geeft het nieuwe begin en einde terug (in minuten).
 */
export function applyDrag(
  mode: "move" | "resize-top" | "resize-bottom" | "create",
  original: { start: number; end: number },
  pointerMinutes: number,
  grabOffset: number,
  step = SNAP
) {
  const length = original.end - original.start;
  if (mode === "move") {
    const start = clamp(snap(pointerMinutes - grabOffset, step), 0, DAY_MINUTES - length);
    return { start, end: start + length };
  }
  if (mode === "resize-bottom") {
    const end = clamp(snap(pointerMinutes, step), original.start + step, DAY_MINUTES);
    return { start: original.start, end };
  }
  if (mode === "resize-top") {
    const start = clamp(snap(pointerMinutes, step), 0, original.end - step);
    return { start, end: original.end };
  }
  // create: van het beginpunt naar de wijzer, in beide richtingen; minimaal één stap
  const anchor = original.start;
  const at = clamp(snap(pointerMinutes, step), 0, DAY_MINUTES);
  const start = Math.min(anchor, at);
  const end = Math.max(anchor, at);
  return end - start >= step ? { start, end } : { start: Math.min(start, DAY_MINUTES - step), end: Math.min(start, DAY_MINUTES - step) + step };
}
