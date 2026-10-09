"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OPEN_STATUSES } from "@/lib/taken/config";
import { addDays, localToday } from "@/lib/taken/dates";
import type { Task } from "@/lib/taken/types";
import InboxActions from "../../_components/InboxActions";
import TaskRow from "../../_components/TaskRow";
import { api, useTaken } from "../../_components/TakenContext";

// Dagafsluiting in drie stappen: inbox naar nul, vandaag afronden, kiezen bij 3× doorgeschoven.

const STEPS = ["Inbox naar nul", "Vandaag afronden", "Knopen doorhakken", "Klaar"];

export default function ClosePage() {
  const { tasks, today, plan, reloadPlan, mergeTasks, updateTask, removeTask, notify } = useTaken();
  const [step, setStep] = useState(0);
  const [keep, setKeep] = useState<string[]>([]); // taken die je bewust niet doorschuift
  const [busy, setBusy] = useState(false);
  const [postponedCount, setPostponedCount] = useState(0);
  const [planFor, setPlanFor] = useState<Record<string, string>>({});

  useEffect(() => {
    reloadPlan();
  }, [reloadPlan]);

  const inbox = tasks.filter((t) => t.status === "inbox");
  const byId = new Map(tasks.map((t) => [t.id, t]));

  // Wat vandaag af had moeten: de top 3 en alles wat voor vandaag (of eerder) ingepland stond.
  const todays = useMemo(() => {
    const ids = new Set<string>(plan?.date === today ? plan.top3.map((p) => p.id) : []);
    for (const t of tasks) if (t.planDate && t.planDate <= today && OPEN_STATUSES.includes(t.status)) ids.add(t.id);
    return Array.from(ids)
      .map((id) => byId.get(id))
      .filter((t): t is Task => Boolean(t && (OPEN_STATUSES.includes(t.status) || t.status === "af")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, plan, today]);

  const stuck = tasks.filter((t) => t.postponed >= 3 && OPEN_STATUSES.includes(t.status));
  const doneToday = tasks.filter((t) => t.status === "af" && t.doneAt && localToday(t.doneAt) === today).length;

  const finishToday = async () => {
    setBusy(true);
    try {
      const postpone = todays.filter((t) => t.status !== "af" && !keep.includes(t.id)).map((t) => t.id);
      const data = await api<{ tasks: Task[] }>("/api/taken/close", {
        method: "POST",
        body: JSON.stringify({ date: today, postpone, done: [] }),
      });
      mergeTasks(data.tasks);
      setPostponedCount(postpone.length);
      setStep(2);
    } catch (err: any) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  const decide = (task: Task, choice: "doen" | "inplannen" | "ooit" | "schrappen") => {
    if (choice === "doen") updateTask(task.id, { planDate: addDays(today, 1), postponed: 0, status: "gepland" });
    if (choice === "inplannen") {
      const date = planFor[task.id];
      if (!date) return notify("Kies eerst een datum.");
      updateTask(task.id, { planDate: date, postponed: 0, status: "gepland" });
    }
    if (choice === "ooit") updateTask(task.id, { status: "ooit", postponed: 0, planDate: null });
    if (choice === "schrappen") removeTask(task.id);
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <header>
        <h1 className="tk-h1">Dag afsluiten</h1>
        <div className="tk-steps mt-3" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? "is-on" : ""} />
          ))}
        </div>
        <div className="tk-muted mt-2 text-sm">
          Stap {Math.min(step + 1, 4)} van 4 · {STEPS[step]}
        </div>
      </header>

      {step === 0 && (
        <>
          <p className="tk-muted text-sm">Geef alles in je Inbox een plek. Dan begin je morgen met een schone lei.</p>
          <div className="tk-list">
            {inbox.length === 0 ? (
              <div className="tk-empty">Inbox is leeg.</div>
            ) : (
              inbox.map((task) => (
                <TaskRow key={task.id} task={task} hideArea>
                  <InboxActions task={task} />
                </TaskRow>
              ))
            )}
          </div>
          <button type="button" className={`tk-btn ${inbox.length ? "tk-btn-ghost" : ""}`} onClick={() => setStep(1)}>
            {inbox.length ? `Overslaan (${inbox.length} blijven staan)` : "Verder"}
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <p className="tk-muted text-sm">
            Vink af wat af is. De rest schuift door naar morgen en telt één keer extra mee.
          </p>
          <div className="tk-list">
            {todays.length === 0 ? (
              <div className="tk-empty">Er stond vandaag niets ingepland.</div>
            ) : (
              todays.map((task) => (
                <TaskRow key={task.id} task={task}>
                  {task.status !== "af" && (
                    <label className="tk-muted flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!keep.includes(task.id)}
                        onChange={(e) =>
                          setKeep((k) => (e.target.checked ? k.filter((id) => id !== task.id) : [...k, task.id]))
                        }
                      />
                      Doorschuiven{task.postponed >= 2 ? ` (wordt ${task.postponed + 1}×)` : ""}
                    </label>
                  )}
                </TaskRow>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="tk-btn tk-btn-ghost" onClick={() => setStep(0)}>
              Terug
            </button>
            <button type="button" className="tk-btn flex-1" disabled={busy} onClick={finishToday}>
              {busy ? "Bezig…" : "Verder"}
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="tk-muted text-sm">
            {stuck.length
              ? "Deze taken zijn al 3× of vaker doorgeschoven. Tijd om te kiezen."
              : "Geen taken die te vaak zijn doorgeschoven."}
          </p>
          {stuck.length > 0 && (
            <div className="tk-list">
              {stuck.map((task) => (
                <TaskRow key={task.id} task={task}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" className="tk-btn tk-btn-sm" onClick={() => decide(task, "doen")}>
                      Morgen echt doen
                    </button>
                    <input
                      type="date"
                      className="tk-input"
                      style={{ width: "auto", padding: "4px 8px", fontSize: 13 }}
                      min={addDays(today, 1)}
                      value={planFor[task.id] || ""}
                      onChange={(e) => setPlanFor((p) => ({ ...p, [task.id]: e.target.value }))}
                      aria-label="Inplannen op"
                    />
                    <button
                      type="button"
                      className="tk-btn tk-btn-ghost tk-btn-sm"
                      onClick={() => decide(task, "inplannen")}
                    >
                      Inplannen
                    </button>
                    <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => decide(task, "ooit")}>
                      Ooit
                    </button>
                    <button
                      type="button"
                      className="tk-btn tk-btn-danger tk-btn-sm"
                      onClick={() => decide(task, "schrappen")}
                    >
                      Schrappen
                    </button>
                  </div>
                </TaskRow>
              ))}
            </div>
          )}
          <button
            type="button"
            className={`tk-btn ${stuck.length ? "tk-btn-ghost" : ""}`}
            onClick={() => setStep(3)}
          >
            {stuck.length ? "Later beslissen" : "Verder"}
          </button>
        </>
      )}

      {step === 3 && (
        <div className="tk-card p-6 text-center">
          <div style={{ fontSize: 40 }}>🌙</div>
          <h2 className="mt-2 text-xl font-bold">Dag afgesloten</h2>
          <p className="tk-muted mt-2">
            {doneToday} {doneToday === 1 ? "taak" : "taken"} af vandaag
            {postponedCount ? `, ${postponedCount} doorgeschoven naar morgen` : ""}.
            <br />
            Morgen staat je nieuwe top 3 klaar.
          </p>
          <Link href="/app" className="tk-btn mt-5">
            Naar Vandaag
          </Link>
        </div>
      )}
    </div>
  );
}

