import { NextResponse } from "next/server";
import { scheduleJob } from "@/lib/taken/qstash";
import { fail } from "@/lib/taken/server";
import { requireAccess } from "@/lib/taken/session";
import { setValue } from "@/lib/taken/store";
import { newId } from "@/lib/taken/validate";

export const dynamic = "force-dynamic";

// Zelfde sleutel als in app/api/taken/cron/route.ts.
const FOCUS_KEY = "push:focus";

// Focus-timer gestart: een melding inplannen voor het einde (ook als de app dan dicht is).
export async function POST(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const endsAt = Number(body?.endsAt);
    const minutes = Math.round(Number(body?.minutes) || 0);
    const title = typeof body?.title === "string" ? body.title.slice(0, 120) : "je taak";
    if (!Number.isFinite(endsAt) || endsAt <= Date.now() || endsAt - Date.now() > 4 * 3600000) {
      return NextResponse.json({ error: "Ongeldige eindtijd." }, { status: 400 });
    }
    const id = newId();
    await setValue(FOCUS_KEY, JSON.stringify({ id, endsAt, minutes, title }));
    const scheduled = Boolean(await scheduleJob(endsAt, { job: "focus", id }));
    return NextResponse.json({ scheduled });
  } catch (error) {
    return fail("push focus POST", error, "Kon de melding niet inplannen.");
  }
}

// Timer gestopt of gepauzeerd: de geplande melding vervalt (bij afvuren wordt dit gecontroleerd).
export async function DELETE(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  await setValue(FOCUS_KEY, null);
  return NextResponse.json({ ok: true });
}
