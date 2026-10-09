import { NextResponse } from "next/server";
import { getEvents } from "@/lib/taken/agenda-server";
import { addDays, diffDays } from "@/lib/taken/dates";
import { syncFromPlanner } from "@/lib/taken/planner-sync";
import { dayFrom, fail, noStore } from "@/lib/taken/server";
import type { Task } from "@/lib/taken/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const from = dayFrom(params.get("from"));
    let to = dayFrom(params.get("to") || from);
    if (to < from) to = from;
    if (diffDays(from, to) > 62) to = addDays(from, 62);
    // Afspraken ophalen en tegelijk timeblocks bijwerken die in Google zijn verplaatst of verwijderd.
    const [data, updatedTasks] = await Promise.all([
      getEvents(from, to, params.get("fresh") === "1"),
      syncFromPlanner(from, to).catch((error) => {
        console.error("taken planner sync", error);
        return [] as Task[];
      }),
    ]);
    return NextResponse.json({ ...data, updatedTasks }, { headers: noStore });
  } catch (error) {
    return fail("agenda GET", error, "Kon je agenda niet ophalen.");
  }
}
