import { NextResponse } from "next/server";
import { clearSessionCookie, currentSession } from "@/lib/taken/session";
import { deleteSessions } from "@/lib/taken/store";

export const dynamic = "force-dynamic";

// Uitloggen op dit apparaat: de sessie verdwijnt en het cookie wordt gewist.
export async function POST(request: Request) {
  const session = await currentSession(request).catch(() => null);
  if (session) await deleteSessions([session.id]);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(request, response);
  return response;
}
