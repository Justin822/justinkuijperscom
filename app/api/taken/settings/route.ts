import { NextResponse } from "next/server";
import { clearIcsCache, isPublicHttpsUrl, normalizeIcsUrl, testIcs } from "@/lib/taken/agenda-server";
import { disconnect, refreshCalendars, selectCalendars, setDefaultCalendar } from "@/lib/taken/google";
import { fail, noStore } from "@/lib/taken/server";
import { hashToken, makeToken } from "@/lib/taken/capture";
import { DEFAULT_MAIL } from "@/lib/taken/gmail";
import { publicSettings } from "@/lib/taken/settings";
import { getPushSubscriptions, getSettings, updateSettings } from "@/lib/taken/store";
import { DEFAULT_PUSH } from "@/lib/taken/push-messages";
import { cleanAreas } from "@/lib/taken/config";
import { newId } from "@/lib/taken/validate";
import { requireAccess } from "@/lib/taken/session";

export const dynamic = "force-dynamic";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function GET(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ settings: publicSettings(await getSettings(), (await getPushSubscriptions()).length) }, { headers: noStore });
  } catch (error) {
    return fail("settings GET", error, "Kon je instellingen niet ophalen.");
  }
}

export async function POST(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const reply = async (extra: object = {}) =>
      NextResponse.json({ settings: publicSettings(await getSettings(), (await getPushSubscriptions()).length), ...extra });

    switch (body?.action) {
      case "addIcs": {
        const url = normalizeIcsUrl(typeof body.url === "string" ? body.url : "");
        const name = (typeof body.name === "string" && body.name.trim().slice(0, 40)) || "Outlook";
        if (!isPublicHttpsUrl(url)) return bad("Plak een openbare link die begint met https:// of webcal://.");
        const settings = await getSettings();
        if (settings.icsSources.length >= 10) return bad("Je kunt maximaal 10 agenda-links toevoegen.");
        if (settings.icsSources.some((s) => s.url === url)) return bad("Deze agenda staat er al in.");
        let found: number;
        try {
          found = await testIcs(name, url);
        } catch (error: any) {
          return bad(`Kon de agenda niet lezen (${error?.message || "onbekende fout"}). Controleer de link.`);
        }
        await updateSettings((s) => ({ ...s, icsSources: [...s.icsSources, { id: newId(), name, url }] }));
        return reply({ found });
      }
      case "removeIcs": {
        await updateSettings((s) => ({ ...s, icsSources: s.icsSources.filter((x) => x.id !== body.id) }));
        clearIcsCache();
        return reply();
      }
      case "workday": {
        const { start, end } = body;
        if (!TIME.test(start) || !TIME.test(end) || start >= end) return bad("Kies een begintijd vóór de eindtijd.");
        await updateSettings((s) => ({ ...s, workday: { start, end } }));
        return reply();
      }
      case "googleCalendars": {
        const selected = Array.isArray(body.selected) ? body.selected.filter((x: unknown) => typeof x === "string") : [];
        await selectCalendars(selected);
        return reply();
      }
      case "googleDefault": {
        if (typeof body.calendarId !== "string") return bad("Kies een agenda.");
        await setDefaultCalendar(body.calendarId);
        return reply();
      }
      case "googleRefresh": {
        try {
          await refreshCalendars();
        } catch (error: any) {
          return bad(`Agenda's ophalen mislukt: ${error?.message || "onbekende fout"}`);
        }
        return reply();
      }
      case "captureCreate": {
        // Het token zelf zie je maar één keer; bewaard wordt alleen de hash.
        const name = (typeof body.name === "string" && body.name.trim().slice(0, 40)) || "Telefoon";
        if (((await getSettings()).captureTokens || []).length >= 10) return bad("Je kunt maximaal 10 sleutels hebben.");
        const token = makeToken();
        const entry = { id: newId(), name, hash: hashToken(token), createdAt: Date.now(), lastUsedAt: null };
        await updateSettings((s) => ({ ...s, captureTokens: [...(s.captureTokens || []), entry] }));
        return reply({ token, tokenId: entry.id });
      }
      case "captureRevoke": {
        await updateSettings((s) => ({ ...s, captureTokens: (s.captureTokens || []).filter((t) => t.id !== body.id) }));
        return reply();
      }
      case "mailEnable":
      case "mailDisable": {
        const enabled = body.action === "mailEnable";
        await updateSettings((s) => ({ ...s, mail: { ...DEFAULT_MAIL, ...(s.mail || {}), enabled, lastError: null } }));
        return reply();
      }
      case "push": {
        // Voorkeuren voor pushmeldingen (gelden voor al je apparaten).
        const current = { ...DEFAULT_PUSH, ...((await getSettings()).push || {}) };
        const next = {
          ochtend: typeof body.ochtend === "boolean" ? body.ochtend : current.ochtend,
          afsluiten: typeof body.afsluiten === "boolean" ? body.afsluiten : current.afsluiten,
          focus: typeof body.focus === "boolean" ? body.focus : current.focus,
          afsluitTijd: typeof body.afsluitTijd === "string" && TIME.test(body.afsluitTijd) ? body.afsluitTijd : current.afsluitTijd,
        };
        await updateSettings((s) => ({ ...s, push: next }));
        return reply();
      }
      case "areas": {
        // Je eigen gebieden (naam, kort, kleur, trefwoorden, volgorde, archiveren).
        const areas = cleanAreas(body.areas);
        if (typeof areas === "string") return bad(areas);
        await updateSettings((s) => ({ ...s, areas }));
        return reply();
      }
      case "googleDisconnect": {
        await disconnect();
        return reply();
      }
      default:
        return bad("Onbekende actie.");
    }
  } catch (error) {
    return fail("settings POST", error, "Kon de instellingen niet opslaan.");
  }
}
