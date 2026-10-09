import { NextResponse } from "next/server";
import { deleteTask, getTask, saveTasks } from "@/lib/taken/store";
import { fail } from "@/lib/taken/server";
import { applyPatch, cleanPatch } from "@/lib/taken/validate";

export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const task = await getTask(params.id);
    if (!task) return NextResponse.json({ error: "Deze taak bestaat niet meer." }, { status: 404 });
    const next = applyPatch(task, cleanPatch(await request.json().catch(() => ({}))));
    await saveTasks([next]);
    return NextResponse.json({ task: next });
  } catch (error) {
    return fail("task PATCH", error, "Kon de taak niet bijwerken.");
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    await deleteTask(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail("task DELETE", error, "Kon de taak niet verwijderen.");
  }
}
