import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { authUrl, googleConfigured, redirectUri } from "@/lib/taken/google";
import { requireAccess } from "@/lib/taken/session";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "taken_google_state";

// Start van "Koppel Google Agenda": door naar Google, met een state-cookie tegen vervalsing.
export async function GET(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  const redirect = redirectUri(request);
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/app/instellingen?google=niet-ingesteld", redirect));
  }
  const state = randomBytes(16).toString("hex");
  // ?mail=1: ook het recht voor de mail-radar vragen (Gmail-labels).
  const withMail = new URL(request.url).searchParams.get("mail") === "1";
  const response = NextResponse.redirect(authUrl(redirect, state, withMail));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: redirect.startsWith("https:"),
    maxAge: 600,
    path: "/api/taken/google",
  });
  return response;
}
