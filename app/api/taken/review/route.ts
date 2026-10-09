import { NextResponse } from "next/server";
import { addDays } from "@/lib/taken/dates";
import { getDays } from "@/lib/taken/store";
import { dayFrom, fail, noStore } from "@/lib/taken/server";

export const dynamic = "force-dynamic";

// Dagplannen van een week (vanaf ?from=maandag), voor de weekreview.
export async function GET(request: Request) {
  try {
    const from = dayFrom(new URL(request.url).searchParams.get("from"));
    const dates = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    return NextResponse.json({ dates, plans: await getDays(dates) }, { headers: noStore });
  } catch (error) {
    return fail("review GET", error, "Kon de weekreview niet ophalen.");
  }
}
