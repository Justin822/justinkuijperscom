import { NextResponse } from "next/server";
import { clearIcsCache, normalizeIcsUrl, testIcs } from "@/lib/taken/agenda-server";
import { disconnect, refreshCalendars, selectCalendars, setDefaultCalendar } from "@/lib/taken/google";
import { fail, noStore } from "@/lib/taken/server";
import { publicSettings } from "@/lib/taken/settings";
import { getSettings, updateSettings } from "@/lib/taken/store";
import { newId } from "@/lib/taken/validate";

export const dynamic = "force-dynamic";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function GET() {
  try {
    return NextResponse.json({ settings: publicSettings(await getSettings()) }, { headers: noStore });
  } catch (error) {
    return fail("settings GET", error, "Kon je instellingen niet ophalen.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const reply = async (extra: object = {}) =>
      NextResponse.json({ settings: publicSettings(await getSettings()), ...extra });

    switch (body?.action) {
      case "addIcs": {
        const url = normalizeIcsUrl(typeof body.url === "string" ? body.url : "");
        const name = (typeof body.name === "string" && body.name.trim().slice(0, 40)) || "Outlook";
        if (!/^https?:\/\/\S+$/i.test(url)) return bad("Plak een link die begint met https:// of webcal://.");
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
