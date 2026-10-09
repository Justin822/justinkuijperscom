import { DEFAULT_TZ, meetingLink } from "./ics";
import { getSettings, updateSettings } from "./store";
import type { CalendarEvent, GoogleCalendar, GoogleLink, Task } from "./types";

// Google Agenda koppelen via OAuth, zonder extra pakketten.
// Lezen: alle gekozen agenda's (calendar.readonly).
// Schrijven: alleen de eigen agenda "Planner" die de app zelf aanmaakt (calendar.app.created).

const AUTH_BASE = process.env.GOOGLE_OAUTH_BASE || "https://accounts.google.com";
const TOKEN_BASE = process.env.GOOGLE_TOKEN_BASE || "https://oauth2.googleapis.com";
const API_BASE = process.env.GOOGLE_API_BASE || "https://www.googleapis.com";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.app.created",
];
export const PLANNER_NAME = "Planner";

const clientId = () => process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET || "";
export const googleConfigured = () => Boolean(clientId() && clientSecret());

export class GoogleError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

/** De callback-URL op het domein waar de app nu draait. */
export function redirectUri(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return `${proto}://${host}/api/taken/google/callback`;
}

export function authUrl(redirect: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirect,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_BASE}/o/oauth2/v2/auth?${params}`;
}

const TIMEOUT = 7000;

/**
 * Eén verzoek naar Google met een tijdslimiet (inclusief het lezen van het antwoord).
 * Logt per stap hoe lang het duurde, zonder tokens of codes, zodat je in de Vercel-logs ziet waar het hapert.
 */
async function request(url: string, init: RequestInit, label: string, ms = TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const started = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const text = res.status === 204 ? "" : await res.text();
    console.log(`taken google: ${label} ${res.status} in ${Date.now() - started}ms`);
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    return { status: res.status, ok: res.ok, data };
  } catch (error: any) {
    const reason = error?.cause?.code || error?.cause?.message || error?.message || "onbekend";
    console.error(`taken google: ${label} mislukt na ${Date.now() - started}ms (${reason})`);
    if (controller.signal.aborted) throw new GoogleError(`Google (${label}): geen antwoord binnen ${ms / 1000} s`);
    throw new GoogleError(`Google (${label}): netwerkfout (${reason})`);
  } finally {
    clearTimeout(timer);
  }
}

async function tokenRequest(body: Record<string, string>, label: string) {
  const { ok, status, data } = await request(
    `${TOKEN_BASE}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...body }).toString(),
    },
    label
  );
  if (!ok) throw new GoogleError(data.error_description || data.error || `Google ${status}`, status);
  return data as { access_token: string; expires_in: number; refresh_token?: string; id_token?: string };
}

function emailFromIdToken(idToken?: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from((idToken || "").split(".")[1], "base64url").toString("utf8"));
    return payload.email || null;
  } catch {
    return null;
  }
}

// ---------- Access-token ----------
let cachedToken: { token: string; until: number; refresh: string } | null = null;

async function accessToken(link: GoogleLink): Promise<string> {
  if (cachedToken && cachedToken.refresh === link.refreshToken && Date.now() < cachedToken.until) return cachedToken.token;
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: link.refreshToken }, "token vernieuwen");
    cachedToken = { token: t.access_token, until: Date.now() + Math.min(t.expires_in || 3600, 3000) * 1000, refresh: link.refreshToken };
    return t.access_token;
  } catch (error: any) {
    if (error instanceof GoogleError && error.status === 400) {
      // Toegang ingetrokken of verlopen: de app vraagt om opnieuw koppelen.
      await updateSettings((s) => (s.google ? { ...s, google: { ...s.google, needsReconnect: true } } : s));
    }
    throw error;
  }
}

async function api<T = any>(link: GoogleLink, path: string, label: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = await accessToken(link);
  const { ok, status, data } = await request(
    `${API_BASE}/calendar/v3${path}`,
    {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
    },
    label
  );
  if (status === 401 && !retried) {
    cachedToken = null;
    return api(link, path, label, init, true);
  }
  if (!ok) throw new GoogleError(data.error?.message || `Google Agenda ${status}`, status);
  return data as T;
}

const enc = encodeURIComponent;

// ---------- Koppelen ----------
async function listCalendars(link: GoogleLink): Promise<GoogleCalendar[]> {
  const data = await api<{ items?: any[] }>(link, "/users/me/calendarList?maxResults=250", "agendalijst");
  return (data.items || []).map((c) => ({
    id: c.id,
    name: c.summaryOverride || c.summary || c.id,
    color: c.backgroundColor || null,
    selected: !c.hidden,
  }));
}

async function ensurePlanner(link: GoogleLink, calendars: GoogleCalendar[]): Promise<string | null> {
  if (link.plannerCalendarId && calendars.some((c) => c.id === link.plannerCalendarId)) return link.plannerCalendarId;
  try {
    const created = await api<{ id: string }>(link, "/calendars", "Planner aanmaken", {
      method: "POST",
      body: JSON.stringify({
        summary: PLANNER_NAME,
        description: "Timeblocks uit je Planner (justinkuijpers.com/app).",
        timeZone: DEFAULT_TZ,
      }),
    });
    return created.id;
  } catch (error) {
    console.error("taken google planner", error);
    return null;
  }
}

/**
 * Terug van Google: alleen de code omwisselen en de koppeling bewaren, zodat dit verzoek kort blijft.
 * Agenda's ophalen en "Planner" klaarzetten gebeurt daarna in refreshCalendars().
 */
export async function connect(code: string, redirect: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirect }, "code omwisselen");
  const previous = (await getSettings()).google;
  const refreshToken = t.refresh_token || previous?.refreshToken;
  if (!refreshToken) throw new GoogleError("Google gaf geen blijvende toegang terug. Probeer opnieuw te koppelen.");
  cachedToken = { token: t.access_token, until: Date.now() + Math.min(t.expires_in || 3600, 3000) * 1000, refresh: refreshToken };

  const link: GoogleLink = {
    refreshToken,
    email: emailFromIdToken(t.id_token) || previous?.email || null,
    // Eerdere keuzes (welke agenda's tonen) en de agenda Planner blijven bewaard bij opnieuw koppelen.
    calendars: previous?.calendars || [],
    plannerCalendarId: previous?.plannerCalendarId || null,
    needsReconnect: false,
  };
  const started = Date.now();
  await updateSettings((s) => ({ ...s, google: link }));
  console.log(`taken google: koppeling opgeslagen in ${Date.now() - started}ms`);
  eventCache.clear();
  return link;
}

export async function disconnect() {
  const link = (await getSettings()).google;
  if (link) {
    await request(`${TOKEN_BASE}/revoke?token=${enc(link.refreshToken)}`, { method: "POST" }, "toegang intrekken").catch(() => {});
  }
  cachedToken = null;
  eventCache.clear();
  await updateSettings((s) => ({ ...s, google: null }));
}

// ---------- Lezen ----------
const eventCache = new Map<string, { at: number; events: CalendarEvent[] }>();
const TTL = 3 * 60 * 1000;
export const clearGoogleCache = () => eventCache.clear();

function toEvent(calendar: GoogleCalendar, e: any): CalendarEvent | null {
  if (e.status === "cancelled" || !e.start) return null;
  const allDay = Boolean(e.start.date);
  const start = allDay ? Date.parse(`${e.start.date}T00:00:00Z`) : Date.parse(e.start.dateTime);
  const end = allDay ? Date.parse(`${e.end?.date || e.start.date}T00:00:00Z`) : Date.parse(e.end?.dateTime || e.start.dateTime);
  if (isNaN(start) || isNaN(end)) return null;
  return {
    id: `g:${calendar.id}:${e.id}`,
    calendar: calendar.name,
    title: e.summary || "(geen titel)",
    location: e.location || null,
    allDay,
    start,
    end: Math.max(end, allDay ? start + 86400000 : start),
    startDate: allDay ? e.start.date : null,
    endDate: allDay ? e.end?.date || null : null,
    busy: !allDay && e.transparency !== "transparent",
    color: calendar.color,
    link: e.htmlLink || null,
    meetUrl:
      e.hangoutLink ||
      e.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === "video")?.uri ||
      meetingLink(`${e.location || ""} ${e.description || ""}`),
  };
}


/** Afspraken uit de gekozen Google-agenda's tussen twee tijdstippen. */
export async function googleEvents(from: number, to: number): Promise<{ events: CalendarEvent[]; errors: string[] }> {
  const link = (await getSettings()).google;
  if (!link || link.needsReconnect || !googleConfigured()) {
    return { events: [], errors: link?.needsReconnect ? ["Google Agenda: opnieuw koppelen"] : [] };
  }
  // Eerst één keer inloggen bij Google, zodat een verlopen koppeling één duidelijke melding geeft.
  try {
    await accessToken(link);
  } catch (error: any) {
    const expired = error instanceof GoogleError && error.status === 400;
    return { events: [], errors: [expired ? "Google Agenda: koppel opnieuw in Instellingen" : `Google Agenda: ${error?.message || "niet bereikbaar"}`] };
  }
  const errors: string[] = [];
  const lists = await Promise.all(
    link.calendars
      .filter((c) => c.selected && c.id !== link.plannerCalendarId)
      .map(async (calendar) => {
        const key = `${calendar.id}|${from}|${to}`;
        const hit = eventCache.get(key);
        if (hit && Date.now() - hit.at < TTL) return hit.events;
        try {
          const events: CalendarEvent[] = [];
          let pageToken = "";
          for (let page = 0; page < 5; page++) {
            const params = new URLSearchParams({
              singleEvents: "true",
              orderBy: "startTime",
              timeMin: new Date(from).toISOString(),
              timeMax: new Date(to).toISOString(),
              maxResults: "2500",
            });
            if (pageToken) params.set("pageToken", pageToken);
            const data = await api<{ items?: any[]; nextPageToken?: string }>(
              link,
              `/calendars/${enc(calendar.id)}/events?${params}`,
              "afspraken"
            );
            for (const item of data.items || []) {
              const event = toEvent(calendar, item);
              if (event) events.push(event);
            }
            if (!data.nextPageToken) break;
            pageToken = data.nextPageToken;
          }
          eventCache.set(key, { at: Date.now(), events });
          return events;
        } catch (error: any) {
          errors.push(`${calendar.name}: ${error?.message || "niet bereikbaar"}`);
          return [];
        }
      })
  );
  return { events: lists.flat(), errors };
}

/** Kies welke Google-agenda's in de app zichtbaar zijn. */
export async function selectCalendars(selected: string[]) {
  eventCache.clear();
  return updateSettings((s) =>
    s.google
      ? { ...s, google: { ...s.google, calendars: s.google.calendars.map((c) => ({ ...c, selected: selected.includes(c.id) })) } }
      : s
  );
}

/**
 * Agendalijst ophalen (nieuwe agenda's in Google verschijnen dan ook in de app)
 * en de agenda "Planner" klaarzetten als die er nog niet is.
 */
export async function refreshCalendars() {
  const link = (await getSettings()).google;
  if (!link) return null;
  const fresh = await listCalendars(link);
  const plannerCalendarId = await ensurePlanner(link, fresh);
  const before = new Map(link.calendars.map((c) => [c.id, c.selected]));
  eventCache.clear();
  return updateSettings((s) =>
    s.google
      ? {
          ...s,
          google: {
            ...s.google,
            plannerCalendarId,
            calendars: fresh
              .filter((c) => c.id !== plannerCalendarId)
              .map((c) => ({ ...c, selected: before.has(c.id) ? (before.get(c.id) as boolean) : c.selected })),
          },
        }
      : s
  );
}

// ---------- Schrijven: timeblocks ----------
function addMinutesLocal(blockStart: string, minutes: number) {
  const [date, time] = blockStart.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h, mi + minutes));
  return t.toISOString().slice(0, 16);
}

const blockFields = (t: Task | null) =>
  t && t.blockStart ? JSON.stringify([t.blockStart, t.estimate || 30, t.title, t.status === "af"]) : null;

/**
 * Houdt het timeblock van een taak gelijk met de agenda "Planner" in Google.
 * Geeft het (nieuwe) event-id terug; een fout laat de taak zelf gewoon opslaan.
 */
export async function syncBlock(before: Task | null, after: Task | null): Promise<{ eventId: string | null; error: string | null }> {
  const current = after?.googleEventId ?? before?.googleEventId ?? null;
  if (blockFields(before) === blockFields(after) && (current || !after?.blockStart)) return { eventId: current, error: null };

  const link = (await getSettings()).google;
  if (!link || !link.plannerCalendarId || link.needsReconnect || !googleConfigured()) return { eventId: current, error: null };
  const calendar = `/calendars/${enc(link.plannerCalendarId)}/events`;

  try {
    if (!after || !after.blockStart) {
      if (current) {
        await api(link, `${calendar}/${enc(current)}`, "timeblock verwijderen", { method: "DELETE" }).catch((error) => {
          if (!(error instanceof GoogleError) || ![404, 410].includes(error.status)) throw error;
        });
      }
      return { eventId: null, error: null };
    }
    const body = JSON.stringify({
      summary: `${after.status === "af" ? "✓ " : ""}${after.title}`,
      description: "Ingepland in je Planner: justinkuijpers.com/app",
      start: { dateTime: `${after.blockStart}:00`, timeZone: DEFAULT_TZ },
      end: { dateTime: `${addMinutesLocal(after.blockStart, after.estimate || 30)}:00`, timeZone: DEFAULT_TZ },
      extendedProperties: { private: { plannerTaskId: after.id } },
    });
    if (current) {
      try {
        await api(link, `${calendar}/${enc(current)}`, "timeblock bijwerken", { method: "PATCH", body });
        return { eventId: current, error: null };
      } catch (error) {
        // Event in Google weggehaald: opnieuw aanmaken.
        if (!(error instanceof GoogleError) || ![404, 410].includes(error.status)) throw error;
      }
    }
    const created = await api<{ id: string }>(link, calendar, "timeblock aanmaken", { method: "POST", body });
    return { eventId: created.id, error: null };
  } catch (error: any) {
    console.error("taken google sync", error);
    return { eventId: current, error: error?.message || "Google Agenda niet bereikbaar" };
  }
}
