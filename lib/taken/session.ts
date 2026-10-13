import { NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, newSessionId, signSession, verifySession } from "./access";
import { deleteSessions, getSession, saveSession, type Session } from "./store";

// Sessies in de route handlers: elk API-verzoek controleert of de sessie nog bestaat.
// (De middleware controleert alleen de handtekening; zie lib/taken/access.ts.)

const MAX_AGE_MS = ACCESS_MAX_AGE * 1000;

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** De sessie van dit verzoek, of null als die ontbreekt, ongeldig is, is ingetrokken of verlopen. */
export async function currentSession(request: Request): Promise<Session | null> {
  const id = await verifySession(cookieValue(request, ACCESS_COOKIE));
  if (!id) return null;
  const session = await getSession(id);
  if (!session) return null;
  if (Date.now() - session.createdAt > MAX_AGE_MS) {
    await deleteSessions([id]);
    return null;
  }
  // Hooguit eens per uur bijwerken wanneer dit apparaat het laatst actief was.
  if (Date.now() - session.lastSeenAt > 3600000) {
    const seen = { ...session, lastSeenAt: Date.now() };
    await saveSession(seen);
    return seen;
  }
  return session;
}

/** Voor elke API-route: null als het verzoek mag, anders een 401-antwoord. */
export async function requireAccess(request: Request): Promise<NextResponse | null> {
  if (await currentSession(request)) return null;
  return NextResponse.json({ error: "Log eerst in." }, { status: 401 });
}

/** Een korte apparaatnaam uit de user agent, zodat je je sessies herkent. */
export function deviceName(userAgent: string | null): string {
  const ua = userAgent || "";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS X/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Onbekend apparaat";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${browser} op ${os}` : os;
}

const secureFor = (request: Request) =>
  request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";

/** Nieuwe sessie aanmaken en het cookie op het antwoord zetten. */
export async function startSession(request: Request, response: NextResponse) {
  const id = newSessionId();
  const value = await signSession(id);
  if (!value) throw new Error("Geen wachtwoord of TAKEN_SECRET ingesteld");
  const now = Date.now();
  await saveSession({ id, createdAt: now, lastSeenAt: now, device: deviceName(request.headers.get("user-agent")) });
  response.cookies.set(ACCESS_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: secureFor(request), maxAge: ACCESS_MAX_AGE, path: "/" });
}

export function clearSessionCookie(request: Request, response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: secureFor(request), maxAge: 0, path: "/" });
}
