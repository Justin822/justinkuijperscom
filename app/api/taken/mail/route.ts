import { NextResponse } from "next/server";
import { runMailRadar } from "@/lib/taken/gmail";
import { fail } from "@/lib/taken/server";
import { requireAccess } from "@/lib/taken/session";
import { takeThrottle } from "@/lib/taken/store";

export const dynamic = "force-dynamic";

// Mail-radar vanuit de app: bij openen (hooguit eens per 2 minuten) of met "Nu controleren" ({ force: true }).
export async function POST(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    if (!body?.force && !(await takeThrottle("mail-radar", 120))) return NextResponse.json({ tasks: [], skipped: true });
    const { created, error } = await runMailRadar();
    return NextResponse.json({ tasks: created, error });
  } catch (error) {
    return fail("mail POST", error, "Kon je mail niet controleren.");
  }
}
