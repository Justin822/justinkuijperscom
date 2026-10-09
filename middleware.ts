import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessToken, teamCode } from "@/lib/rankingthestars/access";
import * as taken from "@/lib/taken/access";

// Ranking the Stars:
// 1. Subdomein (rankingthestars.… of rts.…) wordt doorgestuurd naar /rankingthestars.
// 2. Alles van het spel (pagina's, API, foto's) zit achter de teamcode (RTS_TEAM_CODE).
// Taken-app:
// 1. Subdomein app.… wordt doorgestuurd naar /taken.
// 2. /taken en /api/taken zitten achter het wachtwoord (TAKEN_PASSWORD).

const PROTECTED = /^\/(rankingthestars|api\/rankingthestars|rts-photos)(\/|$)/;
const OPEN = ["/api/rankingthestars/login", "/rankingthestars/toegang"];

const TAKEN_PROTECTED = /^\/(taken|api\/taken)(\/|$)/;
const TAKEN_OPEN = ["/api/taken/login", "/taken/toegang"];
// Op het subdomein blijven deze paden zoals ze zijn (API, PWA-bestanden, Next.js zelf).
const TAKEN_PASSTHROUGH = /^\/(taken|api|taken-pwa|taken-sw\.js|_next|favicon\.ico)(\/|$)/;

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  let rewritten = false;

  const host = request.headers.get("host") || "";
  if (
    /^(rankingthestars|rts)\./i.test(host) &&
    !/^\/(rankingthestars|api|rts-photos)(\/|$)/.test(url.pathname)
  ) {
    url.pathname = "/rankingthestars" + (url.pathname === "/" ? "" : url.pathname);
    rewritten = true;
  }
  if (/^app\./i.test(host) && !TAKEN_PASSTHROUGH.test(url.pathname)) {
    url.pathname = "/taken" + (url.pathname === "/" ? "" : url.pathname);
    rewritten = true;
  }

  const pass = () => (rewritten ? NextResponse.rewrite(url) : NextResponse.next());

  if (TAKEN_PROTECTED.test(url.pathname)) {
    if (TAKEN_OPEN.includes(url.pathname)) return pass();
    const pw = taken.password();
    const expected = pw ? await taken.accessToken(pw) : null;
    if (expected && request.cookies.get(taken.ACCESS_COOKIE)?.value === expected) return pass();
    if (url.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Log eerst in." }, { status: 401 });
    }
    url.pathname = "/taken/toegang";
    return NextResponse.rewrite(url);
  }

  if (!PROTECTED.test(url.pathname) || OPEN.includes(url.pathname)) return pass();

  const code = teamCode();
  const expected = code ? await accessToken(code) : null;

  // Link met ?code=… logt direct in en haalt de code daarna uit de adresbalk.
  const urlCode = request.nextUrl.searchParams.get("code");
  if (expected && urlCode && (await accessToken(urlCode)) === expected) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("code");
    const response = NextResponse.redirect(clean);
    response.cookies.set(ACCESS_COOKIE, expected, {
      httpOnly: true,
      sameSite: "lax",
      secure: clean.protocol === "https:",
      maxAge: ACCESS_MAX_AGE,
      path: "/",
    });
    return response;
  }

  if (expected && request.cookies.get(ACCESS_COOKIE)?.value === expected) return pass();

  if (url.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Vul eerst de teamcode in." }, { status: 401 });
  }
  if (url.pathname.startsWith("/rts-photos")) {
    return new NextResponse("Niet gevonden", { status: 404 });
  }
  url.pathname = "/rankingthestars/toegang";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
