import { AREA_BY_ID } from "./config";
import { isIsoDate } from "./dates";
import type { AreaId, Impact, Source, Status, Task } from "./types";

// Alles wat van de browser komt, gaat hier doorheen voordat het wordt opgeslagen.

const STATUSES: Status[] = ["inbox", "gepland", "bezig", "wachten", "ooit", "af"];
const IMPACTS: Impact[] = ["laag", "middel", "hoog"];
const SOURCES: Source[] = ["handmatig", "spraak", "doorgestuurd", "mail-radar"];

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

const url = (value: unknown) => {
  const s = text(value, 2000);
  return s && /^https?:\/\//i.test(s) ? s : null;
};

/** Alleen de velden die geldig zijn; onbekende velden vallen weg. */
export function cleanPatch(input: any): Partial<Task> {
  const patch: Partial<Task> = {};
  if (!input || typeof input !== "object") return patch;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);

  if (has("title") && text(input.title, 300)) patch.title = text(input.title, 300) as string;
  if (has("areaId")) patch.areaId = input.areaId in AREA_BY_ID ? (input.areaId as AreaId) : null;
  if (has("project")) patch.project = text(input.project, 80);
  if (has("deadline")) patch.deadline = isIsoDate(input.deadline) ? input.deadline : null;
  if (has("deadlineHard")) patch.deadlineHard = Boolean(input.deadlineHard);
  if (has("estimate")) {
    const n = Math.round(Number(input.estimate));
    patch.estimate = n > 0 && n <= 1440 ? n : null;
  }
  if (has("impact")) patch.impact = IMPACTS.includes(input.impact) ? input.impact : null;
  if (has("status") && STATUSES.includes(input.status)) patch.status = input.status;
  if (has("source") && SOURCES.includes(input.source)) patch.source = input.source;
  if (has("mailLink")) patch.mailLink = url(input.mailLink);
  if (has("postponed")) patch.postponed = Math.max(0, Math.min(99, Math.round(Number(input.postponed) || 0)));
  if (has("planDate")) patch.planDate = isIsoDate(input.planDate) ? input.planDate : null;
  if (has("waitingOn")) patch.waitingOn = text(input.waitingOn, 120);
  if (has("followUp")) patch.followUp = isIsoDate(input.followUp) ? input.followUp : null;
  if (has("note")) patch.note = text(input.note, 5000);
  return patch;
}

/** Past een wijziging toe en houdt doneAt/updatedAt bij. */
export function applyPatch(task: Task, patch: Partial<Task>, now = Date.now()): Task {
  const next: Task = { ...task, ...patch, updatedAt: now };
  if (patch.status === "af" && task.status !== "af") next.doneAt = now;
  if (patch.status && patch.status !== "af") next.doneAt = null;
  return next;
}

export function newTask(input: any, now = Date.now()): Task | null {
  const patch = cleanPatch(input);
  if (!patch.title) return null;
  const id = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return applyPatch(
    {
      id,
      title: patch.title,
      areaId: null,
      project: null,
      deadline: null,
      deadlineHard: false,
      estimate: null,
      impact: null,
      status: "inbox",
      source: "handmatig",
      mailLink: null,
      postponed: 0,
      planDate: null,
      waitingOn: null,
      followUp: null,
      note: null,
      createdAt: now,
      updatedAt: now,
      doneAt: null,
    },
    patch,
    now
  );
}
