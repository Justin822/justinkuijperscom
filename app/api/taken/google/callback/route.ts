import { NextRequest, NextResponse } from "next/server";
import { connect, redirectUri } from "@/lib/taken/google";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "taken_google_state";

// Terug van Google: code omwisselen, agenda's ophalen en terug naar de instellingen.
export async function GET(request: NextRequest) {
  const redirect = redirectUri(request);
  const params = request.nextUrl.searchParams;
  const back = (query: string) => {
    const response = NextResponse.redirect(new URL(`/app/instellingen?${query}`, redirect));
    response.cookies.set(STATE_COOKIE, "", { path: "/api/taken/google", maxAge: 0 });
    return response;
  };

  if (params.get("error")) return back(`google=geannuleerd`);
  const state = params.get("state");
  const code = params.get("code");
  if (!state || !code || state !== request.cookies.get(STATE_COOKIE)?.value) {
    return back("google=fout&reden=" + encodeURIComponent("De koppeling is verlopen. Probeer het nog een keer."));
  }
  try {
    await connect(code, redirect);
    return back("google=gekoppeld");
  } catch (error: any) {
    console.error("taken google callback", error);
    return back("google=fout&reden=" + encodeURIComponent(error?.message || "onbekende fout"));
  }
}
