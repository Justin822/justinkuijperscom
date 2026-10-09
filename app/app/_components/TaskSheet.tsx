"use client";

import { useEffect, useMemo, useState } from "react";
import { ESTIMATES, estimateLabel, IMPACT_LABEL, STATUS_LABEL } from "@/lib/taken/config";
import { addDays } from "@/lib/taken/dates";
import type { Impact, Status, Task } from "@/lib/taken/types";
import AreaPills from "./AreaPills";
import { TrashIcon, XIcon } from "./icons";
import { useTaken } from "./TakenContext";

const SOURCE_LABEL: Record<Task["source"], string> = {
  handmatig: "getypt",
  spraak: "ingesproken",
  doorgestuurd: "doorgestuurde mail",
  "mail-radar": "mail-radar",
};

// Alle velden van één taak. Wijzigingen gaan pas weg bij "Opslaan".
export default function TaskSheet({ id }: { id: string }) {
  const { tasks, openTask, updateTask, removeTask, notify, today, addTasks } = useTaken();
  const task = tasks.find((t) => t.id === id);
  const [draft, setDraft] = useState<Task | null>(task || null);

  useEffect(() => {
    if (!task) openTask(null);
  }, [task, openTask]);

  const projects = useMemo(
    () =>
      Array.from(
        new Set(tasks.filter((t) => t.project && (!draft?.areaId || t.areaId === draft.areaId)).map((t) => t.project as string))
      ).sort(),
    [tasks, draft?.areaId]
  );

  if (!task || !draft) return null;
  const set = <K extends keyof Task>(key: K, value: Task[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = () => {
    const patch: Partial<Task> = {};
    (Object.keys(draft) as (keyof Task)[]).forEach((k) => {
      if (draft[k] !== task[k]) (patch as any)[k] = draft[k];
    });
    if (!draft.title.trim()) delete patch.title;
    if (Object.keys(patch).length) updateTask(task.id, patch);
    openTask(null);
  };

  const remove = () => {
    removeTask(task.id);
    openTask(null);
    const { id: _id, createdAt, updatedAt, doneAt, ...copy } = task;
    notify("Taak verwijderd", () => addTasks([copy]));
  };

  return (
    <div className="tk-overlay" onClick={save}>
      <div
        className="tk-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Taak bewerken"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <textarea
            className="tk-textarea"
            style={{ fontSize: 18, fontWeight: 600, resize: "none", border: 0, padding: "4px 0", boxShadow: "none" }}
            rows={2}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            aria-label="Titel"
          />
          <button type="button" className="tk-icon-btn" onClick={save} aria-label="Sluiten">
            <XIcon />
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-4">
          <div className="tk-field">
            <span className="tk-label">Gebied</span>
            <AreaPills value={draft.areaId} onPick={(a) => set("areaId", draft.areaId === a ? null : a)} />
          </div>

          <label className="tk-field">
            <span className="tk-label">Project</span>
            <input
              className="tk-input"
              list="tk-projects"
              value={draft.project || ""}
              onChange={(e) => set("project", e.target.value || null)}
              placeholder="bijv. Leadgeneratie"
            />
            <datalist id="tk-projects">
              {projects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>

          <div className="tk-field">
            <span className="tk-label">Status</span>
            <div className="tk-seg">
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <button key={s} type="button" aria-pressed={draft.status === s} onClick={() => set("status", s)}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {draft.status === "wachten" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="tk-field">
                <span className="tk-label">Wachten op</span>
                <input
                  className="tk-input"
                  value={draft.waitingOn || ""}
                  onChange={(e) => set("waitingOn", e.target.value || null)}
                  placeholder="Naam"
                />
              </label>
              <label className="tk-field">
                <span className="tk-label">Nabellen op</span>
                <input
                  className="tk-input"
                  type="date"
                  value={draft.followUp || ""}
                  onChange={(e) => set("followUp", e.target.value || null)}
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="tk-field">
              <span className="tk-label">Deadline</span>
              <input
                className="tk-input"
                type="date"
                value={draft.deadline || ""}
                onChange={(e) => set("deadline", e.target.value || null)}
              />
            </label>
            <label className="tk-field">
              <span className="tk-label">Doen op</span>
              <input
                className="tk-input"
                type="date"
                value={draft.planDate || ""}
                onChange={(e) => set("planDate", e.target.value || null)}
              />
            </label>
          </div>
          <div className="-mt-2 flex flex-wrap items-center gap-2">
            <div className="tk-seg">
              <button
                type="button"
                aria-pressed={!draft.deadlineHard}
                onClick={() => set("deadlineHard", false)}
                disabled={!draft.deadline}
              >
                Zachte deadline
              </button>
              <button
                type="button"
                aria-pressed={draft.deadlineHard}
                onClick={() => set("deadlineHard", true)}
                disabled={!draft.deadline}
              >
                Harde deadline
              </button>
            </div>
            <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => set("planDate", today)}>
              Vandaag doen
            </button>
            <button
              type="button"
              className="tk-btn tk-btn-ghost tk-btn-sm"
              onClick={() => set("planDate", addDays(today, 1))}
            >
              Morgen
            </button>
          </div>

          <div className="tk-field">
            <span className="tk-label">Tijdsinschatting</span>
            <div className="tk-seg">
              {ESTIMATES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={draft.estimate === m}
                  onClick={() => set("estimate", draft.estimate === m ? null : m)}
                >
                  {estimateLabel(m)}
                </button>
              ))}
            </div>
          </div>

          <div className="tk-field">
            <span className="tk-label">Impact</span>
            <div className="tk-seg">
              {(Object.keys(IMPACT_LABEL) as Impact[]).map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={draft.impact === i}
                  onClick={() => set("impact", draft.impact === i ? null : i)}
                >
                  {IMPACT_LABEL[i]}
                </button>
              ))}
            </div>
          </div>

          <label className="tk-field">
            <span className="tk-label">Link naar mail</span>
            <input
              className="tk-input"
              type="url"
              value={draft.mailLink || ""}
              onChange={(e) => set("mailLink", e.target.value || null)}
              placeholder="https://mail.google.com/…"
            />
          </label>

          <label className="tk-field">
            <span className="tk-label">Notitie</span>
            <textarea
              className="tk-textarea"
              rows={3}
              value={draft.note || ""}
              onChange={(e) => set("note", e.target.value || null)}
            />
          </label>

          <div className="tk-faint flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>Bron: {SOURCE_LABEL[task.source]}</span>
            <span>Aangemaakt {new Date(task.createdAt).toLocaleDateString("nl-NL")}</span>
            {draft.postponed > 0 && (
              <span>
                {draft.postponed}× doorgeschoven ·{" "}
                <button type="button" className="underline" onClick={() => set("postponed", 0)}>
                  op 0 zetten
                </button>
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button type="button" className="tk-btn tk-btn-danger" onClick={remove} aria-label="Verwijderen">
              <TrashIcon className="h-4 w-4" />
            </button>
            <button type="button" className="tk-btn flex-1" onClick={save}>
              Opslaan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
