import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { password, safeEqual } from "@/lib/taken/access";
import { startSession } from "@/lib/taken/session";
import { addLoginFailure, clearLoginFailures, loginFailures } from "@/lib/taken/store";

export const dynamic = "force-dynamic";

const MAX_FAILURES = 10;
const digest = (pw: string) => createHash("sha256").update(`taken-login:${pw.trim()}`, "utf8").digest("hex");
const clientIp = (request: Request) =>
  (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "onbekend";

export async function POST(request: Request) {
  try {
    const pw = password();
    if (!pw) {
      return NextResponse.json({ error: "Er is nog geen wachtwoord ingesteld (TAKEN_PASSWORD)." }, { status: 503 });
    }

    // Te vaak mis vanaf dit adres: een kwartier wachten.
    const ip = clientIp(request);
    if ((await loginFailures(ip)) >= MAX_FAILURES) {
      return NextResponse.json({ error: "Te veel pogingen. Probeer het over een kwartier opnieuw." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const given = typeof body?.password === "string" ? body.password : "";
    if (!given || !safeEqual(digest(given), digest(pw))) {
      await addLoginFailure(ip);
      // kleine vertraging maakt raden onaantrekkelijk
      await new Promise((resolve) => setTimeout(resolve, 800));
      return NextResponse.json({ error: "Dat wachtwoord klopt niet." }, { status: 401 });
    }

    await clearLoginFailures(ip);
    const response = NextResponse.json({ ok: true });
    await startSession(request, response);
    return response;
  } catch (error: any) {
    console.error("taken login", error);
    return NextResponse.json(
      { error: `Inloggen mislukt door een serverfout: ${error?.message || "onbekend"}` },
      { status: 500 }
    );
  }
}
