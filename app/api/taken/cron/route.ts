import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/taken/cron";
import { runMailRadar } from "@/lib/taken/gmail";
import { fail } from "@/lib/taken/server";

export const dynamic = "force-dynamic";

// Geplande ronde (zie vercel.json en lib/taken/cron.ts): mail-radar ook als de app dicht is.
async function run(request: Request) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  try {
    const mail = await runMailRadar();
    return NextResponse.json({ mail: { created: mail.created.length, error: mail.error } });
  } catch (error) {
    return fail("cron", error, "Geplande ronde mislukt.");
  }
}

export const GET = run;
export const POST = run;
