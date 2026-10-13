import { NextResponse } from "next/server";
import { findToken, tokenFrom } from "./capture";
import { getSettings, updateSettings } from "./store";
import type { CaptureToken } from "./types";

// Toegang met een snelknop-token in plaats van het inlogcookie.

export async function requireToken(request: Request): Promise<CaptureToken | NextResponse> {
  const found = findToken((await getSettings()).captureTokens, tokenFrom(request));
  if (!found) return NextResponse.json({ error: "Ongeldige of ingetrokken sleutel." }, { status: 401 });
  // Bijhouden wanneer de sleutel voor het laatst is gebruikt (hooguit eens per uur een schrijfactie).
  if (!found.lastUsedAt || Date.now() - found.lastUsedAt > 3600000) {
    await updateSettings((s) => ({
      ...s,
      captureTokens: (s.captureTokens || []).map((t) => (t.id === found.id ? { ...t, lastUsedAt: Date.now() } : t)),
    }));
  }
  return found;
}

/** Antwoord als JSON, of als één regel tekst (?format=text) voor een melding op je telefoon. */
export function respond(request: Request, json: object, text: string, status = 200) {
  if (new URL(request.url).searchParams.get("format") === "text") {
    return new NextResponse(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  return NextResponse.json(json, { status, headers: { "Cache-Control": "no-store" } });
}
