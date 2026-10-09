import { NextResponse } from "next/server";
import { makePlan } from "@/lib/taken/score";
import { getDay, getTasks, saveDay } from "@/lib/taken/store";
import { dayContext, dayFrom, fail, noStore, recentPlans, syncPlan } from "@/lib/taken/server";
import type { DayPlan } from "@/lib/taken/types";

export const dynamic = "force-dynamic";

// De top 3 wordt bij de eerste keer openen van de dag gekozen en daarna vastgehouden.

async function todayPlan(date: string): Promise<DayPlan> {
  const tasks = await getTasks();
  const existing = await getDay(date);
  if (existing && (existing.top3.length >= 3 || existing.closedAt)) return syncPlan(existing, tasks);
  const ctx = await dayContext(date, tasks);
  if (existing) return syncPlan(existing, tasks, ctx);
  const plan = makePlan(tasks, date, await recentPlans(date), ctx);
  await saveDay(plan);
  return plan;
}

export async function GET(request: Request) {
  try {
    const date = dayFrom(new URL(request.url).searchParams.get("date"));
    return NextResponse.json({ plan: await todayPlan(date) }, { headers: noStore });
  } catch (error) {
    return fail("today GET", error, "Kon je top 3 niet ophalen.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const date = dayFrom(body?.date);
    const id = typeof body?.id === "string" ? body.id : "";
    let plan = await todayPlan(date);

    if (body?.action === "swap" && id) {
      // Eruit, en vandaag niet meer voorstellen; syncPlan vult de plek aan.
      plan = await syncPlan({
        ...plan,
        top3: plan.top3.filter((p) => p.id !== id),
        swapped: Array.from(new Set([...plan.swapped, id])),
      });
    } else if (body?.action === "promote" && id && !plan.top3.some((p) => p.id === id)) {
      // Zelf een taak in de top 3 zetten: die vervangt de laatste nog open taak.
      const tasks = await getTasks();
      const done = new Set(tasks.filter((t) => t.status === "af").map((t) => t.id));
      const openPicks = plan.top3.filter((p) => !done.has(p.id));
      const drop = openPicks.length >= 3 ? openPicks[openPicks.length - 1].id : null;
      const top3 = [...plan.top3.filter((p) => p.id !== drop), { id, reason: "Zelf gekozen" }];
      plan = await syncPlan({ ...plan, top3, swapped: plan.swapped.filter((s) => s !== id) }, tasks);
      await saveDay(plan);
    } else if (body?.action === "recompute") {
      const tasks = await getTasks();
      const fresh = makePlan(
        tasks.filter((t) => !plan.swapped.includes(t.id)),
        date,
        await recentPlans(date),
        await dayContext(date, tasks)
      );
      plan = { ...fresh, swapped: plan.swapped, closedAt: plan.closedAt };
      await saveDay(plan);
    } else {
      return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
    }
    return NextResponse.json({ plan });
  } catch (error) {
    return fail("today POST", error, "Kon je top 3 niet aanpassen.");
  }
}
