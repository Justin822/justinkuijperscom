import { NextResponse } from "next/server";
import { syncBlock } from "@/lib/taken/google";
import { archiveDoneTasks, getTask, getTasks, saveTasks, takeThrottle } from "@/lib/taken/store";
import type { Task } from "@/lib/taken/types";
import { fail, noStore } from "@/lib/taken/server";
import { newTask } from "@/lib/taken/validate";
import { makeDelta, sinceParam } from "@/lib/taken/delta";
import { requireAccess } from "@/lib/taken/session";

export const dynamic = "force-dynamic";

const RECENT_DONE = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const now = Date.now();
    // Een paar keer per dag oude afgeronde taken archiveren; mag het ophalen nooit laten mislukken.
    if (await takeThrottle("archief", 6 * 3600).catch(() => false)) {
      await archiveDoneTasks(now).catch((error) => console.error("taken archief", error));
    }
    // Afgeronde taken alleen van de laatste 30 dagen meesturen; met ?since= alleen wat sindsdien veranderde.
    const tasks = (await getTasks()).filter((t) => t.status !== "af" || now - (t.doneAt || t.updatedAt) < RECENT_DONE);
    const delta = makeDelta(tasks, sinceParam(request), now);
    return NextResponse.json({ tasks: delta.items, ids: delta.ids, now: delta.now }, { headers: noStore });
  } catch (error) {
    return fail("tasks GET", error, "Kon je taken niet ophalen.");
  }
}

export async function POST(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const input: unknown[] = Array.isArray(body?.tasks) ? body.tasks.slice(0, 50) : [];
    const now = Date.now();
    const made = input.map((t, i) => newTask(t, now + i)).filter(Boolean) as NonNullable<ReturnType<typeof newTask>>[];
    if (!made.length) return NextResponse.json({ error: "Geef de taak een titel." }, { status: 400 });
    // Opnieuw verstuurd (bijv. vanuit de offline-wachtrij): een taak met dit id bestaat al, dan die teruggeven.
    const existing = new Map<string, Task>();
    for (const t of made) {
      const found = (input as any[]).some((x) => x?.id === t.id) ? await getTask(t.id) : null;
      if (found) existing.set(t.id, found);
    }
    const tasks = made.filter((t) => !existing.has(t.id));
    // Direct met een tijd aangemaakt (vanuit de agenda): meteen in Google Agenda zetten.
    let syncError = false;
    for (let i = 0; i < tasks.length; i++) {
      if (!tasks[i].blockStart) continue;
      const sync = await syncBlock(null, tasks[i]);
      tasks[i] = { ...tasks[i], googleEventId: sync.eventId, googleSyncedAt: sync.syncedAt };
      if (sync.error) syncError = true;
    }
    await saveTasks(tasks);
    tasks.push(...Array.from(existing.values()));
    return NextResponse.json({ tasks, sync: syncError ? "fout" : "ok" });
  } catch (error) {
    return fail("tasks POST", error, "Kon de taak niet opslaan.");
  }
}
