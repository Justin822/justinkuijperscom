import { NextResponse } from "next/server";
import { eventFail, times, title } from "@/lib/taken/events-api";
import { createEvent } from "@/lib/taken/google";
import { requireAccess } from "@/lib/taken/session";

export const dynamic = "force-dynamic";

/** Nieuwe afspraak in Google Agenda (standaard in je hoofdagenda). */
export async function POST(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const name = title(body?.title);
    const span = times(body?.start, body?.end);
    if (!name || !span) return NextResponse.json({ error: "Geef de afspraak een titel en een tijd." }, { status: 400 });
    const calendarId = typeof body?.calendarId === "string" ? body.calendarId : null;
    return NextResponse.json({ event: await createEvent(calendarId, { title: name, ...span }) });
  } catch (error) {
    return eventFail("event POST", error);
  }
}
