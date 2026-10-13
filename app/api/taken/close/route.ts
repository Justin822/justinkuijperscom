import { NextResponse } from "next/server";
import { claimPostpones, emptyPlan, postponeTask } from "@/lib/taken/close";
import { syncBlock } from "@/lib/taken/google";
import { dayFrom, fail } from "@/lib/taken/server";
import { requireAccess } from "@/lib/taken/session";
import { getTasks, mutateDay, mutateTask } from "@/lib/taken/store";
import type { Task } from "@/lib/taken/types";

export const dynamic = "force-dynamic";

// Dagafsluiting: de rest van vandaag schuift door (teller +1), zie lib/taken/close.ts.

export async function POST(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const date = dayFrom(body?.date);
    const postpone: string[] = Array.isArray(body?.postpone) ? body.postpone.filter((id: unknown) => typeof id === "string") : [];
    const now = Date.now();

    // 1. Eerst in het dagplan vastleggen welke taken doorschuiven (atomair), dan pas de taken zelf.
    let claimed: string[] = [];
    await mutateDay(date, (current) => {
      const claim = claimPostpones(current, date, postpone);
      claimed = claim.claimed;
      return claim.plan;
    });

    // 2. Elke taak doorschuiven op basis van zijn laatste stand; vervallen timeblocks ook uit Google halen.
    const changed: Task[] = [];
    for (const id of claimed) {
      let before: Task | null = null;
      const result = await mutateTask(id, (current) => {
        before = current;
        return current && postponeTask(current, date, now);
      });
      if (!result.changed || !result.value) continue;
      let task = result.value;
      const sync = await syncBlock(before, task);
      if (sync.eventId !== task.googleEventId || sync.syncedAt !== task.googleSyncedAt) {
        task = (await mutateTask(id, (current) => current && { ...current, googleEventId: sync.eventId, googleSyncedAt: sync.syncedAt })).value || task;
      }
      changed.push(task);
    }

    // 3. De dag als afgesloten markeren, met de inbox op dit moment (voor de weekreview).
    const inboxAtClose = (await getTasks()).filter((t) => t.status === "inbox").length;
    await mutateDay(date, (current) => ({ ...(current || emptyPlan(date)), closedAt: now, inboxAtClose }));
    return NextResponse.json({ tasks: changed });
  } catch (error) {
    return fail("close POST", error, "Kon de dag niet afsluiten.");
  }
}
