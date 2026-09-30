import { NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessToken, teamCode } from "@/lib/rankingthestars/access";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(request: Request) {
  const code = teamCode();
  if (!code) {
    return NextResponse.json({ error: "Er is nog geen teamcode ingesteld (RTS_TEAM_CODE)." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const given = typeof body?.code === "string" ? body.code : "";
  const expected = await accessToken(code);

  if (!given || (await accessToken(given)) !== expected) {
    // kleine vertraging maakt raden onaantrekkelijk
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json({ error: "Die code klopt niet. Vraag het even na bij de spelleider." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    maxAge: ACCESS_MAX_AGE,
    path: "/",
  });
  return response;
}
