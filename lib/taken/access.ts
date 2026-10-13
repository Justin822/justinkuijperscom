// Toegang tot de Planner. Werkt zowel in de middleware (edge) als in route handlers (Web Crypto).
//
// Na inloggen krijgt elk apparaat een eigen sessie: het cookie bevat een willekeurig id plus een
// handtekening (HMAC). De middleware controleert alleen de handtekening; de API-routes controleren
// daarnaast of de sessie nog bestaat (lib/taken/session.ts), zodat uitloggen en intrekken direct werkt.

export const ACCESS_COOKIE = "taken_session";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 180; // 180 dagen

export function password(): string {
  return (process.env.TAKEN_PASSWORD || (process.env.NODE_ENV !== "production" ? "taken" : "")).trim();
}

/** Sleutel voor handtekeningen. Zonder TAKEN_SECRET afgeleid van het wachtwoord: een nieuw wachtwoord logt alles uit. */
function secret(): string | null {
  const own = (process.env.TAKEN_SECRET || "").trim();
  if (own) return `secret:${own}`;
  const pw = password();
  return pw ? `password:${pw}` : null;
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(value: string): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`planner-session:${value}`)));
}

/** Vergelijken zonder dat de duur verraadt hoeveel tekens kloppen. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function newSessionId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return hex(bytes.buffer);
}

/** Cookiewaarde voor een sessie: "<id>.<handtekening>". */
export async function signSession(id: string): Promise<string | null> {
  const sig = await hmac(id);
  return sig ? `${id}.${sig}` : null;
}

/** Het sessie-id uit een cookiewaarde, als de handtekening klopt. */
export async function verifySession(value: string | undefined | null): Promise<string | null> {
  if (!value) return null;
  const [id, sig] = value.split(".");
  if (!id || !sig || !/^[0-9a-f]{48}$/.test(id)) return null;
  const expected = await hmac(id);
  return expected && safeEqual(sig, expected) ? id : null;
}
