import { NextResponse } from "next/server";
import { syncBlock } from "@/lib/taken/google";
import { deleteTask, getTask, saveTasks } from "@/lib/taken/store";
import { completeWithRepeat, dayFrom, fail } from "@/lib/taken/server";
import { applyPatch, cleanPatch } from "@/lib/taken/validate";

export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

export async function PATCH(request: Request, { params }: Context) {
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
    // Timeblock gelijk houden met de agenda "Planner" in Google.
    const sync = await syncBlock(task, next);
    next = { ...next, googleEventId: sync.eventId };
    await saveTasks([next, ...created]);
    return NextResponse.json({ task: next, created, sync: sync.error ? "fout" : "ok" });
  } catch (error) {
    return fail("task PATCH", error, "Kon de taak niet bijwerken.");
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const task = await getTask(params.id);
    if (task?.googleEventId) await syncBlock(task, null);
    await deleteTask(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail("task DELETE", error, "Kon de taak niet verwijderen.");
  }
}
