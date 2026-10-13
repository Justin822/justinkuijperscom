import { OPEN_STATUSES } from "./config";
import type { DayPlan, PushPrefs, Task } from "./types";

// Wat er in een pushmelding staat, zonder te versturen (zie push.ts).

export const DEFAULT_PUSH: PushPrefs = { ochtend: true, afsluiten: true, afsluitTijd: "17:30", focus: true };

export type PushAction = { action: "af" | "morgen" | "open"; title: string };

export type PushMessage = {
  title: string;
  body: string;
  /** Zelfde tag vervangt een eerdere melding in plaats van er een bij te zetten. */
  tag: string;
  url: string;
  taskId?: string;
  actions?: PushAction[];
};

const TASK_ACTIONS: PushAction[] = [
  { action: "af", title: "Afvinken" },
  { action: "morgen", title: "Naar morgen" },
];

/** De ochtendmeldingen: je top 3, en per taak een melding voor deadlines en nabellen van vandaag (max. 3 elk). */
export function morningMessages(tasks: Task[], plan: DayPlan | null, date: string): PushMessage[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: PushMessage[] = [];

  const top = (plan?.top3 || []).map((p) => byId.get(p.id)).filter((t): t is Task => Boolean(t && t.status !== "af"));
  if (top.length) {
    out.push({
      title: "Je top 3 voor vandaag",
      body: top.map((t, i) => `${i + 1}. ${t.title}${t.blockStart?.startsWith(date) ? ` (${t.blockStart.slice(11, 16)})` : ""}`).join("\n"),
      tag: `ochtend-${date}`,
      url: "/app",
    });
  }

  const due = tasks
    .filter((t) => OPEN_STATUSES.includes(t.status) && t.deadline && t.deadline <= date)
    .sort((a, b) => Number(b.deadlineHard) - Number(a.deadlineHard) || (a.deadline as string).localeCompare(b.deadline as string))
    .slice(0, 3);
  for (const t of due) {
    out.push({
      title: t.deadline === date ? `${t.deadlineHard ? "Harde deadline" : "Deadline"} vandaag` : "Deadline verlopen",
      body: t.title,
      tag: `deadline-${t.id}`,
      url: "/app",
      taskId: t.id,
      actions: TASK_ACTIONS,
    });
  }

  const followUps = tasks.filter((t) => t.status === "wachten" && t.followUp && t.followUp <= date).slice(0, 3);
  for (const t of followUps) {
    out.push({
      title: `Nabellen: ${t.waitingOn || "iemand"}`,
      body: t.title,
      tag: `nabellen-${t.id}`,
      url: "/app/taken?lijst=wachten",
      taskId: t.id,
      actions: [{ action: "open", title: "Openen" }],
    });
  }
  return out;
}

/** Herinnering om af te sluiten; null als de dag al is afgesloten. */
export function closeReminder(tasks: Task[], plan: DayPlan | null, date: string): PushMessage | null {
  if (plan?.closedAt) return null;
  const open = tasks.filter(
    (t) => OPEN_STATUSES.includes(t.status) && ((t.planDate && t.planDate <= date) || plan?.top3.some((p) => p.id === t.id))
  ).length;
  return {
    title: "Tijd om je dag af te sluiten",
    body: open ? `${open} ${open === 1 ? "taak staat" : "taken staan"} nog open voor vandaag.` : "Alles van vandaag is af. Sluit even af voor morgen.",
    tag: `afsluiten-${date}`,
    url: "/app/afsluiten",
  };
}

export function focusDone(title: string, minutes: number): PushMessage {
  return { title: "Focus klaar", body: `${minutes} min aan ${title}. Even pauze.`, tag: "focus", url: "/app" };
}
