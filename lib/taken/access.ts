// Wachtwoord voor de taken-app. Werkt zowel in de middleware (edge) als in route handlers.

export const ACCESS_COOKIE = "taken_access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 180; // 180 dagen

export function password(): string {
  return (process.env.TAKEN_PASSWORD || (process.env.NODE_ENV !== "production" ? "taken" : "")).trim();
}

/** Waarde van het toegangscookie: een hash van het wachtwoord, zodat het wachtwoord zelf niet in het cookie staat. */
export function accessInput(pw: string) {
  return `taken-access:${pw.trim()}`;
}

/** Web Crypto-variant voor de middleware (edge). Route handlers gebruiken accessInput met node:crypto. */
export async function accessToken(pw: string): Promise<string> {
  const data = new TextEncoder().encode(accessInput(pw));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
