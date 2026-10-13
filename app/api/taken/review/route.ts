import { NextResponse } from "next/server";
import { addDays } from "@/lib/taken/dates";
import { getDays, getFocus } from "@/lib/taken/store";
import { dayFrom, fail, noStore } from "@/lib/taken/server";
import { requireAccess } from "@/lib/taken/session";

export const dynamic = "force-dynamic";

// Dagplannen en focusminuten van een week (vanaf ?from=maandag), voor de weekreview.
export async function GET(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const from = dayFrom(new URL(request.url).searchParams.get("from"));
    const dates = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const [plans, focus] = await Promise.all([getDays(dates), getFocus(dates)]);
    return NextResponse.json({ dates, plans, focus }, { headers: noStore });
  } catch (error) {
    return fail("review GET", error, "Kon de weekreview niet ophalen.");
  }
}
