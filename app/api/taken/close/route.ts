import { NextResponse } from "next/server";
import { closeDay } from "@/lib/taken/close";
import { syncBlock } from "@/lib/taken/google";
import { getDay, getTasks, saveDay, saveTasks } from "@/lib/taken/store";
import { dayFrom, fail } from "@/lib/taken/server";
import { requireAccess } from "@/lib/taken/session";

export const dynamic = "force-dynamic";

// Dagafsluiting: de rest van vandaag schuift door (teller +1), zie lib/taken/close.ts.

export async function POST(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const date = dayFrom(body?.date);
    const postpone: string[] = Array.isArray(body?.postpone) ? body.postpone.filter((id: unknown) => typeof id === "string") : [];

    const tasks = await getTasks();
    const { changed, plan } = closeDay(tasks, await getDay(date), date, postpone);

    // Timeblocks die vervallen ook uit Google Agenda halen.
    const before = new Map(tasks.map((t) => [t.id, t]));
    const synced = await Promise.all(
      changed.map(async (task) => {
        const sync = await syncBlock(before.get(task.id) || null, task);
        return { ...task, googleEventId: sync.eventId, googleSyncedAt: sync.syncedAt };
      })
    );
    await saveTasks(synced);
    await saveDay(plan);
    return NextResponse.json({ tasks: synced });
  } catch (error) {
    return fail("close POST", error, "Kon de dag niet afsluiten.");
  }
}
