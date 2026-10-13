import { NextResponse } from "next/server";
import { makePlan, promotePick } from "@/lib/taken/score";
import { getTasks, mutateDay } from "@/lib/taken/store";
import type { DayPlan } from "@/lib/taken/types";
import { dayContext, dayFrom, fail, noStore, recentPlans, syncPlan, todayPlan } from "@/lib/taken/server";
import { requireAccess } from "@/lib/taken/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const date = dayFrom(new URL(request.url).searchParams.get("date"));
    return NextResponse.json({ plan: await todayPlan(date) }, { headers: noStore });
  } catch (error) {
    return fail("today GET", error, "Kon je top 3 niet ophalen.");
  }
}

export async function POST(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const date = dayFrom(body?.date);
    const id = typeof body?.id === "string" ? body.id : "";
    let plan = await todayPlan(date);

    if (body?.action === "swap" && id) {
      // Eruit, en vandaag niet meer voorstellen; syncPlan vult de plek aan.
      plan = await syncPlan(
        { ...plan, top3: plan.top3.filter((p) => p.id !== id), swapped: Array.from(new Set([...plan.swapped, id])) },
        undefined,
        {},
        "actie"
      );
    } else if (body?.action === "promote" && id && !plan.top3.some((p) => p.id === id)) {
      // Zelf een taak in de top 3 zetten (zie promotePick).
      const tasks = await getTasks();
      const done = new Set(tasks.filter((t) => t.status === "af").map((t) => t.id));
      const top3 = promotePick(plan.top3, id, done);
      plan = await syncPlan({ ...plan, top3, swapped: plan.swapped.filter((s) => s !== id) }, tasks, {}, "actie");
    } else if (body?.action === "recompute") {
      const tasks = await getTasks();
      const fresh = makePlan(
        tasks.filter((t) => !plan.swapped.includes(t.id)),
        date,
        await recentPlans(date),
        await dayContext(date, tasks)
      );
      // Nieuwe top 3, maar wat de dagafsluiting vastlegde blijft staan.
      plan = (await mutateDay(date, (current) => ({ ...(current || fresh), top3: fresh.top3, areas: fresh.areas, swapped: plan.swapped }))).value as DayPlan;
    } else {
      return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
    }
    return NextResponse.json({ plan });
  } catch (error) {
    return fail("today POST", error, "Kon je top 3 niet aanpassen.");
  }
}
