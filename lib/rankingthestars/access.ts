// Teamcode voor Ranking the Stars. Werkt zowel in de middleware (edge) als in route handlers.

export const ACCESS_COOKIE = "rts_access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 60; // 60 dagen

export function teamCode(): string {
  return normalize(process.env.RTS_TEAM_CODE || (process.env.NODE_ENV !== "production" ? "sterren" : ""));
}

export function normalize(code: string) {
  return code.trim().toLowerCase();
}

/** Waarde van het toegangscookie: een hash van de teamcode, zodat de code zelf niet in het cookie staat. */
export function accessInput(code: string) {
  return `rts-access:${normalize(code)}`;
}

/** Web Crypto-variant voor de middleware (edge). Route handlers gebruiken accessInput met node:crypto. */
export async function accessToken(code: string): Promise<string> {
  const data = new TextEncoder().encode(accessInput(code));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
