import { NextResponse } from "next/server";
import { syncBlock } from "@/lib/taken/google";
import { undoSpawn } from "@/lib/taken/repeat";
import { addFocus, deleteTask, getTask, getTasks, NO_AREA, saveTasks } from "@/lib/taken/store";
import { completeWithRepeat, dayFrom, fail } from "@/lib/taken/server";
import { applyPatch, cleanPatch } from "@/lib/taken/validate";
import { requireAccess } from "@/lib/taken/session";

export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

export async function PATCH(request: Request, { params }: Context) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const task = await getTask(params.id);
    if (!task) return NextResponse.json({ error: "Deze taak bestaat niet meer." }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    let next = applyPatch(task, cleanPatch(body));
    const created = [];
    // Terugkerende taak afgevinkt: de volgende keer staat meteen klaar.
    if (next.status === "af" && task.status !== "af") {
      const result = completeWithRepeat(next, dayFrom(body?.today));
      next = result.done;
      if (result.next) created.push(result.next);
    }
    // Weer opengezet (ook via "Ongedaan maken"): geen dubbele reeks laten staan.
    const removed: string[] = [];
    if (task.status === "af" && next.status !== "af") {
      const undo = undoSpawn(next, await getTasks());
      next = undo.task;
      if (undo.remove) {
        if (undo.remove.googleEventId) await syncBlock(undo.remove, null);
        await deleteTask(undo.remove.id);
        removed.push(undo.remove.id);
      }
    }
    // Timeblock gelijk houden met de agenda "Planner" in Google.
    const sync = await syncBlock(task, next);
    next = { ...next, googleEventId: sync.eventId, googleSyncedAt: sync.syncedAt };
    await saveTasks([next, ...created]);
    // Focus-timer: de gewerkte minuten ook per dag bijhouden, voor de weekreview.
    const focused = next.focusMinutes - task.focusMinutes;
    if (focused > 0) await addFocus(dayFrom(body?.today), task.areaId || NO_AREA, focused);
    return NextResponse.json({ task: next, created, removed, sync: sync.error ? "fout" : "ok" });
  } catch (error) {
    return fail("task PATCH", error, "Kon de taak niet bijwerken.");
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const task = await getTask(params.id);
    if (task?.googleEventId) await syncBlock(task, null);
    await deleteTask(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail("task DELETE", error, "Kon de taak niet verwijderen.");
  }
}
