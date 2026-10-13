import { NextResponse } from "next/server";
import { syncBlock } from "@/lib/taken/google";
import { undoSpawn } from "@/lib/taken/repeat";
import { addFocus, deleteTask, getTask, getTasks, mutateTask, NO_AREA, saveTasks } from "@/lib/taken/store";
import type { Task } from "@/lib/taken/types";
import { completeWithRepeat, dayFrom, fail } from "@/lib/taken/server";
import { applyPatch, cleanPatch } from "@/lib/taken/validate";
import { requireAccess } from "@/lib/taken/session";

export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

export async function PATCH(request: Request, { params }: Context) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const patch = cleanPatch(body);
    const today = dayFrom(body?.today);

    // De wijziging toepassen op de laatste stand (compare-and-set); bij een botsing opnieuw op de verse taak.
    let before: Task | null = null;
    let created: Task[] = [];
    const result = await mutateTask(params.id, (current) => {
      if (!current) return null;
      before = current;
      let next = applyPatch(current, patch);
      created = [];
      // Terugkerende taak afgevinkt: de volgende keer staat meteen klaar.
      if (next.status === "af" && current.status !== "af") {
        const done = completeWithRepeat(next, today);
        next = done.done;
        if (done.next) created.push(done.next);
      }
      return next;
    });
    const task = before as Task | null;
    let next = result.value;
    if (!task || !next) return NextResponse.json({ error: "Deze taak bestaat niet meer." }, { status: 404 });
    if (created.length) await saveTasks(created);

    // Weer opengezet (ook via "Ongedaan maken"): geen dubbele reeks laten staan.
    const removed: string[] = [];
    if (task.status === "af" && next.status !== "af") {
      const undo = undoSpawn(next, await getTasks());
      if (undo.remove) {
        const repeat = undo.task.repeat;
        next = (await mutateTask(params.id, (current) => (current && !current.repeat ? { ...current, repeat } : null))).value || next;
        if (undo.remove.googleEventId) await syncBlock(undo.remove, null);
        await deleteTask(undo.remove.id);
        removed.push(undo.remove.id);
      }
    }

    // Timeblock gelijk houden met de agenda "Planner" in Google; alleen de koppelvelden terugschrijven.
    const sync = await syncBlock(task, next);
    if (sync.eventId !== next.googleEventId || sync.syncedAt !== next.googleSyncedAt) {
      next =
        (await mutateTask(params.id, (current) => current && { ...current, googleEventId: sync.eventId, googleSyncedAt: sync.syncedAt }))
          .value || next;
    }

    // Focus-timer: de gewerkte minuten ook per dag bijhouden, voor de weekreview.
    const focused = next.focusMinutes - task.focusMinutes;
    if (focused > 0) await addFocus(today, task.areaId || NO_AREA, focused);
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
