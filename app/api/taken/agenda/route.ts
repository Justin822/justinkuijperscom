import { NextResponse } from "next/server";
import { getEvents } from "@/lib/taken/agenda-server";
import { addDays, diffDays } from "@/lib/taken/dates";
import { dayFrom, fail, noStore } from "@/lib/taken/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const from = dayFrom(params.get("from"));
    let to = dayFrom(params.get("to") || from);
    if (to < from) to = from;
    if (diffDays(from, to) > 62) to = addDays(from, 62);
    return NextResponse.json(await getEvents(from, to), { headers: noStore });
  } catch (error) {
    return fail("agenda GET", error, "Kon je agenda niet ophalen.");
  }
}
