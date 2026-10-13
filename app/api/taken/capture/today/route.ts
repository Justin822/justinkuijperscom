import { NextResponse } from "next/server";
import { requireToken, respond } from "@/lib/taken/capture-server";
import { estimateLabel } from "@/lib/taken/config";
import { amsterdamToday } from "@/lib/taken/dates";
import { fail, todayPlan } from "@/lib/taken/server";
import { getTasks } from "@/lib/taken/store";

export const dynamic = "force-dynamic";

// Je top 3 van vandaag voor een widget of snelknop (alleen lezen).
export async function GET(request: Request) {
  try {
    const auth = await requireToken(request);
    if (auth instanceof NextResponse) return auth;

    const date = amsterdamToday();
    const tasks = await getTasks();
    const plan = await todayPlan(date, tasks);
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const top3 = plan.top3
      .map((p) => byId.get(p.id))
      .filter(Boolean)
      .map((t) => ({ id: t!.id, title: t!.title, done: t!.status === "af", time: t!.blockStart?.slice(11, 16) || null, estimate: t!.estimate }));
    const lines = top3.map((t) => `${t.done ? "✓" : "○"} ${t.time ? `${t.time} ` : ""}${t.title}${t.estimate && !t.done ? ` · ${estimateLabel(t.estimate)}` : ""}`);
    return respond(request, { date, top3 }, lines.join("\n") || "Nog geen top 3 voor vandaag");
  } catch (error) {
    return fail("capture/today GET", error, "Kon je top 3 niet ophalen.");
  }
}
