import { NextResponse } from "next/server";
import { GoogleError } from "./google";

// Gedeeld door de routes voor Google-afspraken: invoer controleren en fouten leesbaar maken.

const MAX_SPAN = 14 * 24 * 3600000;

export const title = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : null;

/** Begin en eind als tijdstip (ms), of null als ze niet kloppen. */
export function times(start: unknown, end: unknown): { start: number; end: number } | null {
  const s = Number(start);
  const e = Number(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || e - s > MAX_SPAN) return null;
  return { start: Math.round(s), end: Math.round(e) };
}

export function eventFail(where: string, error: any) {
  console.error(`taken ${where}`, error);
  if (error instanceof GoogleError) {
    const status = [400, 403, 404, 410].includes(error.status) ? error.status : 502;
    const message =
      status === 404 || status === 410
        ? "Deze afspraak bestaat niet meer in Google Agenda."
        : status === 403 && !/opnieuw|kun je/.test(error.message)
        ? "Google Agenda staat deze wijziging niet toe."
        : error.message;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ error: `Kon Google Agenda niet bijwerken (${error?.message || "onbekend"})` }, { status: 500 });
}
