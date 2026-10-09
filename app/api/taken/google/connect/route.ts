import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { authUrl, googleConfigured, redirectUri } from "@/lib/taken/google";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "taken_google_state";

// Start van "Koppel Google Agenda": door naar Google, met een state-cookie tegen vervalsing.
export async function GET(request: Request) {
  const redirect = redirectUri(request);
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/app/instellingen?google=niet-ingesteld", redirect));
  }
  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(authUrl(redirect, state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: redirect.startsWith("https:"),
    maxAge: 600,
    path: "/api/taken/google",
  });
  return response;
}
