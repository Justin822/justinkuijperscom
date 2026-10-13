import { NextResponse } from "next/server";
import { fail, noStore } from "@/lib/taken/server";
import { clearSessionCookie, currentSession } from "@/lib/taken/session";
import { deleteSessions, getSessions } from "@/lib/taken/store";

export const dynamic = "force-dynamic";

// Ingelogde apparaten bekijken en uitloggen (één apparaat, of alle andere).

export async function GET(request: Request) {
  try {
    const me = await currentSession(request);
    if (!me) return NextResponse.json({ error: "Log eerst in." }, { status: 401 });
    const sessions = (await getSessions())
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .map(({ id, device, createdAt, lastSeenAt }) => ({ id, device, createdAt, lastSeenAt, current: id === me.id }));
    return NextResponse.json({ sessions }, { headers: noStore });
  } catch (error) {
    return fail("sessions GET", error, "Kon je apparaten niet ophalen.");
  }
}

export async function DELETE(request: Request) {
  try {
    const me = await currentSession(request);
    if (!me) return NextResponse.json({ error: "Log eerst in." }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id");
    const all = await getSessions();
    // ?id=… één apparaat, ?id=anderen alle andere apparaten.
    const ids = id === "anderen" ? all.filter((s) => s.id !== me.id).map((s) => s.id) : all.filter((s) => s.id === id).map((s) => s.id);
    await deleteSessions(ids);
    const response = NextResponse.json({ removed: ids.length });
    if (ids.includes(me.id)) clearSessionCookie(request, response);
    return response;
  } catch (error) {
    return fail("sessions DELETE", error, "Kon niet uitloggen.");
  }
}
