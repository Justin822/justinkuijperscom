import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { CaptureToken } from "./types";

export { toCapture, type Capture, type CaptureInput } from "./capture-parse";

// Sleutels voor snel invoeren van buiten de app (alleen op de server: gebruikt node:crypto).
// Het omzetten van tekst naar taken staat in capture-parse.ts, zodat de browser het ook kan.

export const TOKEN_PREFIX = "pl_";

export function makeToken(): string {
  return TOKEN_PREFIX + randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(`planner-capture:${token}`).digest("hex");
}

/** De sleutel die bij dit token hoort, of null. */
export function findToken(tokens: CaptureToken[] | undefined, token: string | null): CaptureToken | null {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const hash = Buffer.from(hashToken(token), "hex");
  return (tokens || []).find((t) => {
    const stored = Buffer.from(t.hash, "hex");
    return stored.length === hash.length && timingSafeEqual(stored, hash);
  }) || null;
}

/** Het token uit "Authorization: Bearer …" (nooit in de URL, zodat het niet in logs belandt). */
export function tokenFrom(request: Request): string | null {
  const auth = request.headers.get("authorization") || "";
  return auth.match(/^Bearer\s+(\S+)$/i)?.[1] || null;
}
