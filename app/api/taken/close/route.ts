import { NextResponse } from "next/server";
import { addDays } from "@/lib/taken/dates";
import { getDay, getTasks, saveDay, saveTasks } from "@/lib/taken/store";
import { completeWithRepeat, dayFrom, fail } from "@/lib/taken/server";
import type { Task } from "@/lib/taken/types";
import { applyPatch } from "@/lib/taken/validate";

export const dynamic = "force-dynamic";

// Dagafsluiting: afgevinkte taken op af, de rest van vandaag schuift door (teller +1).

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const date = dayFrom(body?.date);
    const done: string[] = Array.isArray(body?.done) ? body.done : [];
    const postpone: string[] = Array.isArray(body?.postpone) ? body.postpone : [];
    const tomorrow = addDays(date, 1);
    const now = Date.now();

    const changed: Task[] = [];
    const tasks = await getTasks();
    for (const task of tasks) {
      if (done.includes(task.id) && task.status !== "af") {
        const result = completeWithRepeat(applyPatch(task, { status: "af" }, now), date, now);
        changed.push(result.done, ...(result.next ? [result.next] : []));
      } else if (postpone.includes(task.id) && task.status !== "af") {
        changed.push(
          applyPatch(
            task,
            {
              postponed: task.postponed + 1,
              planDate: task.planDate && task.planDate <= date ? tomorrow : task.planDate,
            },
            now
          )
        );
      }
    }
    await saveTasks(changed);

    const byId = new Map(tasks.map((t) => [t.id, t]));
    for (const t of changed) byId.set(t.id, t);
    const inboxAtClose = Array.from(byId.values()).filter((t) => t.status === "inbox").length;
    const plan = await getDay(date);
    if (plan) await saveDay({ ...plan, closedAt: now, inboxAtClose });
    return NextResponse.json({ tasks: changed });
  } catch (error) {
    return fail("close POST", error, "Kon de dag niet afsluiten.");
  }
}
