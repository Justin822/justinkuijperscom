import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessInput, password } from "@/lib/taken/access";

export const dynamic = "force-dynamic";

// Zelfde hash als accessToken() in de middleware, maar met node:crypto.
const tokenFor = (pw: string) => createHash("sha256").update(accessInput(pw), "utf8").digest("hex");

export async function POST(request: Request) {
  try {
    const pw = password();
    if (!pw) {
      return NextResponse.json({ error: "Er is nog geen wachtwoord ingesteld (TAKEN_PASSWORD)." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const given = typeof body?.password === "string" ? body.password : "";
    const expected = tokenFor(pw);

    if (!given || tokenFor(given) !== expected) {
      // kleine vertraging maakt raden onaantrekkelijk
      await new Promise((resolve) => setTimeout(resolve, 800));
      return NextResponse.json({ error: "Dat wachtwoord klopt niet." }, { status: 401 });
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
    console.error("taken login", error);
    return NextResponse.json(
      { error: `Inloggen mislukt door een serverfout: ${error?.message || "onbekend"}` },
      { status: 500 }
    );
  }
}
