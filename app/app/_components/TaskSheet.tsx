"use client";

import { useEffect, useMemo, useState } from "react";
import { ESTIMATES, estimateLabel, IMPACT_LABEL, STATUS_LABEL } from "@/lib/taken/config";
import { addDays, weekday, WEEKDAYS } from "@/lib/taken/dates";
import type { Impact, Repeat, Status, Task } from "@/lib/taken/types";
import AreaPills from "./AreaPills";
import { PlayIcon, TrashIcon, XIcon } from "./icons";
import { useTaken } from "./TakenContext";
import { focusLabel } from "./TaskRow";

const SOURCE_LABEL: Record<Task["source"], string> = {
  handmatig: "getypt",
  spraak: "ingesproken",
  doorgestuurd: "doorgestuurde mail",
  "mail-radar": "mail-radar",
  notitie: "uit een notitie",
};

type RepeatChoice = "nooit" | "dag" | "werkdagen" | "week" | "maand";

function repeatChoice(r: Repeat | null): RepeatChoice {
  if (!r) return "nooit";
  if (r.weekdays?.join() === "1,2,3,4,5") return "werkdagen";
  return r.unit;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tk-field">
      <span className="tk-label">{label}</span>
      {children}
    </div>
  );
}

// Alle velden van één taak. Wijzigingen gaan weg bij sluiten of "Opslaan".
export default function TaskSheet({ id }: { id: string }) {
  const { tasks, openTask, updateTask, removeTask, notify, today, addTasks, startFocus } = useTaken();
  const task = tasks.find((t) => t.id === id);
  const [draft, setDraft] = useState<Task | null>(task || null);

  useEffect(() => {
    if (!task) openTask(null);
  }, [task, openTask]);

  const projects = useMemo(
    () =>
      Array.from(
        new Set(
          tasks
            .filter((t) => t.project && (!draft?.areaId || t.areaId === draft.areaId))
            .map((t) => t.project as string)
        )
      ).sort(),
    [tasks, draft?.areaId]
  );

  if (!task || !draft) return null;
  const set = <K extends keyof Task>(key: K, value: Task[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const changes = () => {
    const patch: Partial<Task> = {};
    (Object.keys(draft) as (keyof Task)[]).forEach((k) => {
      if (JSON.stringify(draft[k]) !== JSON.stringify(task[k])) (patch as any)[k] = draft[k];
    });
    if (!draft.title.trim()) delete patch.title;
    return patch;
  };

  const save = () => {
    const patch = changes();
    if (Object.keys(patch).length) updateTask(task.id, patch);
    openTask(null);
  };

  const remove = () => {
    removeTask(task.id);
    openTask(null);
    const { id: _id, createdAt, updatedAt, doneAt, ...copy } = task;
    notify("Taak verwijderd", () => addTasks([copy]));
  };

  const setRepeat = (choice: RepeatChoice) => {
    const day = weekday(draft.planDate || draft.deadline || today);
    const map: Record<RepeatChoice, Repeat | null> = {
      nooit: null,
      dag: { every: 1, unit: "dag", weekdays: null },
      werkdagen: { every: 1, unit: "dag", weekdays: [1, 2, 3, 4, 5] },
      week: { every: 1, unit: "week", weekdays: [day] },
      maand: { every: 1, unit: "maand", weekdays: null },
    };
    setDraft((d) => (d ? { ...d, repeat: map[choice], planDate: d.planDate || (choice === "nooit" ? null : today) } : d));
  };

  const blockDate = draft.blockStart?.slice(0, 10) || "";
  const blockTime = draft.blockStart?.slice(11, 16) || "";
  const setBlock = (date: string, time: string) => set("blockStart", date && time ? `${date}T${time}` : null);

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
            className="tk-input-bare"
            style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", resize: "none", lineHeight: 1.3 }}
            rows={2}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            aria-label="Titel"
          />
          <button type="button" className="tk-icon-btn" onClick={save} aria-label="Sluiten">
            <XIcon />
          </button>
        </div>

        {draft.status !== "af" && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[25, 50, 90].map((m) => (
              <button
                key={m}
                type="button"
                className="tk-btn tk-btn-ghost tk-btn-sm"
                onClick={() => {
                  const patch = changes();
                  if (Object.keys(patch).length) updateTask(task.id, patch);
                  openTask(null);
                  startFocus(task.id, m);
                }}
              >
                <PlayIcon className="h-3 w-3" /> Focus {m} min
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-5">
          <Field label="Gebied">
            <AreaPills value={draft.areaId} onPick={(a) => set("areaId", draft.areaId === a ? null : a)} />
          </Field>

          <Field label="Project">
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
          </Field>

          <Field label="Status">
            <div className="tk-seg">
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <button key={s} type="button" aria-pressed={draft.status === s} onClick={() => set("status", s)}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>

          {draft.status === "wachten" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Wachten op">
                <input
                  className="tk-input"
                  value={draft.waitingOn || ""}
                  onChange={(e) => set("waitingOn", e.target.value || null)}
                  placeholder="Naam"
                />
              </Field>
              <Field label="Nabellen op">
                <input
                  className="tk-input"
                  type="date"
                  value={draft.followUp || ""}
                  onChange={(e) => set("followUp", e.target.value || null)}
                />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Deadline">
              <input
                className="tk-input"
                type="date"
                value={draft.deadline || ""}
                onChange={(e) => set("deadline", e.target.value || null)}
              />
            </Field>
            <Field label="Doen op">
              <input
                className="tk-input"
                type="date"
                value={draft.planDate || ""}
                onChange={(e) => set("planDate", e.target.value || null)}
              />
            </Field>
          </div>
          <div className="-mt-3 flex flex-wrap items-center gap-2">
            <div className="tk-seg">
              <button
                type="button"
                aria-pressed={!draft.deadlineHard}
                onClick={() => set("deadlineHard", false)}
                disabled={!draft.deadline}
              >
                Zacht
              </button>
              <button
                type="button"
                aria-pressed={draft.deadlineHard}
                onClick={() => set("deadlineHard", true)}
                disabled={!draft.deadline}
              >
                Hard
              </button>
            </div>
            <button type="button" className="tk-btn tk-btn-quiet tk-btn-sm" onClick={() => set("planDate", today)}>
              Vandaag doen
            </button>
            <button
              type="button"
              className="tk-btn tk-btn-quiet tk-btn-sm"
              onClick={() => set("planDate", addDays(today, 1))}
            >
              Morgen
            </button>
          </div>

          <Field label="In de agenda (timeblock)">
            <div className="flex gap-2">
              <input
                className="tk-input"
                type="date"
                value={blockDate}
                onChange={(e) => setBlock(e.target.value, blockTime || "09:00")}
              />
              <input
                className="tk-input"
                type="time"
                step={900}
                value={blockTime}
                onChange={(e) => setBlock(blockDate || today, e.target.value)}
                style={{ maxWidth: 130 }}
              />
              {draft.blockStart && (
                <button type="button" className="tk-icon-btn" onClick={() => set("blockStart", null)} aria-label="Uit agenda halen">
                  <XIcon />
                </button>
              )}
            </div>
          </Field>

          <Field label="Tijdsinschatting">
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
          </Field>

          <Field label="Impact">
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
          </Field>

          <Field label="Herhalen">
            <div className="tk-seg">
              {(
                [
                  ["nooit", "Nooit"],
                  ["dag", "Dagelijks"],
                  ["werkdagen", "Werkdagen"],
                  ["week", `Elke ${WEEKDAYS[weekday(draft.planDate || draft.deadline || today)]}`],
                  ["maand", "Maandelijks"],
                ] as [RepeatChoice, string][]
              ).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={repeatChoice(draft.repeat) === value} onClick={() => setRepeat(value)}>
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Link naar mail">
            <input
              className="tk-input"
              type="url"
              value={draft.mailLink || ""}
              onChange={(e) => set("mailLink", e.target.value || null)}
              placeholder="https://mail.google.com/…"
            />
          </Field>

          <Field label="Notitie">
            <textarea
              className="tk-textarea"
              rows={3}
              value={draft.note || ""}
              onChange={(e) => set("note", e.target.value || null)}
            />
          </Field>

          <div className="tk-faint flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>Bron: {SOURCE_LABEL[task.source]}</span>
            <span>Aangemaakt {new Date(task.createdAt).toLocaleDateString("nl-NL")}</span>
            {task.focusMinutes > 0 && <span>{focusLabel(task.focusMinutes)} gefocust</span>}
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
