import { NextResponse } from "next/server";
import { getTasks, saveTasks } from "@/lib/taken/store";
import { fail, noStore } from "@/lib/taken/server";
import { newTask } from "@/lib/taken/validate";

export const dynamic = "force-dynamic";

const RECENT_DONE = 30 * 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const now = Date.now();
    // Afgeronde taken alleen van de laatste 30 dagen meesturen.
    const tasks = (await getTasks()).filter((t) => t.status !== "af" || now - (t.doneAt || t.updatedAt) < RECENT_DONE);
    return NextResponse.json({ tasks }, { headers: noStore });
  } catch (error) {
    return fail("tasks GET", error, "Kon je taken niet ophalen.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const input: unknown[] = Array.isArray(body?.tasks) ? body.tasks.slice(0, 50) : [];
    const now = Date.now();
    const tasks = input.map((t, i) => newTask(t, now + i)).filter(Boolean) as NonNullable<ReturnType<typeof newTask>>[];
    if (!tasks.length) return NextResponse.json({ error: "Geef de taak een titel." }, { status: 400 });
    await saveTasks(tasks);
    return NextResponse.json({ tasks });
  } catch (error) {
    return fail("tasks POST", error, "Kon de taak niet opslaan.");
  }
}
