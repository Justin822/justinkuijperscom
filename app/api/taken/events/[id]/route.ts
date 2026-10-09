import { NextResponse } from "next/server";
import { eventFail, times, title } from "@/lib/taken/events-api";
import { deleteEvent, updateEvent } from "@/lib/taken/google";

export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

/** Afspraak verplaatsen, oprekken of hernoemen (bij een herhaling: alleen deze keer). */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.calendarId !== "string") return bad("Onbekende agenda.");
    const change: { title?: string; start?: number; end?: number; restore?: boolean } = {};
    if (body.title !== undefined) {
      const name = title(body.title);
      if (!name) return bad("Geef de afspraak een titel.");
      change.title = name;
    }
    if (body.start !== undefined || body.end !== undefined) {
      const span = times(body.start, body.end);
      if (!span) return bad("Kies een eindtijd na de begintijd.");
      Object.assign(change, span);
    }
    if (body.restore === true) change.restore = true;
    if (!Object.keys(change).length) return bad("Er is niets te wijzigen.");
    const event = await updateEvent(body.calendarId, params.id, change, body.notify === true);
    return NextResponse.json({ event });
  } catch (error) {
    return eventFail("event PATCH", error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const query = new URL(request.url).searchParams;
    const calendarId = query.get("calendarId");
    if (!calendarId) return bad("Onbekende agenda.");
    await deleteEvent(calendarId, params.id, query.get("notify") === "1");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return eventFail("event DELETE", error);
  }
}
