import { NextRequest, NextResponse } from "next/server";

// Maakt Ranking the Stars ook bereikbaar via een subdomein,
// bijvoorbeeld rankingthestars.justinkuijpers.com of rts.justinkuijpers.com.
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  if (!/^(rankingthestars|rts)\./i.test(host)) return NextResponse.next();

  const url = request.nextUrl.clone();
  if (url.pathname.startsWith("/rankingthestars")) return NextResponse.next();
  url.pathname = "/rankingthestars" + (url.pathname === "/" ? "" : url.pathname);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next|rts-photos|favicon.ico).*)"],
};
