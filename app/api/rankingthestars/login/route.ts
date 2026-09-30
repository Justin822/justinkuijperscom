import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessInput, teamCode } from "@/lib/rankingthestars/access";

export const dynamic = "force-dynamic";

// Zelfde hash als accessToken() in de middleware, maar met node:crypto.
const tokenFor = (code: string) => createHash("sha256").update(accessInput(code), "utf8").digest("hex");

export async function POST(request: Request) {
  try {
    const code = teamCode();
    if (!code) {
      return NextResponse.json({ error: "Er is nog geen teamcode ingesteld (RTS_TEAM_CODE)." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const given = typeof body?.code === "string" ? body.code : "";
    const expected = tokenFor(code);

    if (!given || tokenFor(given) !== expected) {
      // kleine vertraging maakt raden onaantrekkelijk
      await new Promise((resolve) => setTimeout(resolve, 600));
      return NextResponse.json({ error: "Die code klopt niet. Vraag het even na bij de spelleider." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACCESS_COOKIE, expected, {
      httpOnly: true,
      sameSite: "lax",
      secure:
        request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:",
      maxAge: ACCESS_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (error: any) {
    console.error("rts login", error);
    return NextResponse.json(
      { error: `Inloggen mislukt door een serverfout: ${error?.message || "onbekend"}` },
      { status: 500 }
    );
  }
}
