"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OPEN_STATUSES } from "@/lib/taken/config";
import { addDays, formatLong } from "@/lib/taken/dates";
import { rankTasks } from "@/lib/taken/score";
import type { Task } from "@/lib/taken/types";
import { ArrowUpIcon, SwapIcon } from "../_components/icons";
import TaskRow, { CheckButton, TaskMeta } from "../_components/TaskRow";
import { useTaken } from "../_components/TakenContext";

function greeting(hour: number) {
  if (hour < 6) return "Goedenacht";
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

export default function TodayPage() {
  const { tasks, loaded, error, today, plan, reloadPlan, planAction, openTask, updateTask, addRef } = useTaken();
  const [hour, setHour] = useState(9);
  useEffect(() => setHour(new Date().getHours()), []);

  useEffect(() => {
    reloadPlan();
  }, [reloadPlan]);

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const isActive = (t?: Task) => Boolean(t && (OPEN_STATUSES.includes(t.status) || t.status === "af"));
  const picks = (plan?.date === today ? plan.top3 : []).filter((p) => isActive(byId.get(p.id)));
  const pickIds = picks.map((p) => p.id);

  const extra = useMemo(
    () => rankTasks(tasks, today, [], [...pickIds, ...(plan?.swapped || [])]).slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, today, pickIds.join(), plan?.swapped.join()]
  );

  // Een plek vrijgekomen (taak verwijderd of verplaatst) of net een taak toegevoegd: laat de server aanvullen.
  const openPicks = picks.filter((p) => byId.get(p.id)?.status !== "af").length;
  useEffect(() => {
    if (plan && !plan.closedAt && picks.length < 3 && extra.length > 0) reloadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks.length, extra.length]);

  const waitingDue = tasks
    .filter((t) => t.status === "wachten" && t.followUp && t.followUp <= today)
    .sort((a, b) => (a.followUp || "").localeCompare(b.followUp || ""));
  const inboxCount = tasks.filter((t) => t.status === "inbox").length;
  const openCount = tasks.filter((t) => OPEN_STATUSES.includes(t.status)).length;
  const allDone = picks.length > 0 && openPicks === 0;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <header>
        <div className="tk-muted text-sm first-letter:uppercase">{formatLong(today)}</div>
        <h1 className="tk-h1">{greeting(hour)}, Justin</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/taken/inbox" className={`tk-chip ${inboxCount ? "tk-chip-accent" : ""}`}>
            Inbox {inboxCount}
          </Link>
          <Link href="/taken/wachten" className={`tk-chip ${waitingDue.length ? "tk-chip-warn" : ""}`}>
            Nabellen {waitingDue.length}
          </Link>
          <span className="tk-chip">Open {openCount}</span>
        </div>
      </header>

      {error && (
        <div className="tk-card p-4" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="tk-h2">Top 3 van vandaag</h2>
          {plan && picks.length > 0 && (
            <button type="button" className="tk-faint text-xs underline" onClick={() => planAction("recompute")}>
              Opnieuw kiezen
            </button>
          )}
        </div>
        <div className="tk-card">
          {!loaded || !plan ? (
            <div className="tk-empty">Even je dag op een rij zetten…</div>
          ) : picks.length === 0 ? (
            <div className="tk-empty">
              {openCount === 0 ? (
                <>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>Nog niks te doen</div>
                  <p className="mt-1">Typ hierboven je eerste taak, bijvoorbeeld:</p>
                  <p className="mt-2">
                    <em>Offerte Jansen vrijdag, Appèl, half uur</em>
                    <br />
                    <em>Felicio nieuwsbrief uiterlijk 20 okt #hoog</em>
                  </p>
                  <button type="button" className="tk-btn mt-4" onClick={() => addRef.current?.focus()}>
                    Taak toevoegen
                  </button>
                </>
              ) : (
                "Geen kandidaten meer voor vandaag."
              )}
            </div>
          ) : (
            picks.map((p, i) => {
              const task = byId.get(p.id) as Task;
              const done = task.status === "af";
              return (
                <div key={p.id} className={`tk-top ${done ? "is-done" : ""}`}>
                  <CheckButton task={task} />
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openTask(task.id)}>
                    <div className="flex items-baseline gap-2">
                      <span className="tk-top-num">{i + 1}</span>
                      <span className="tk-top-title">{task.title}</span>
                    </div>
                    <div className="tk-top-reason">{p.reason}</div>
                    <TaskMeta task={task} />
                  </div>
                  {!done && !plan?.closedAt && (
                    <button
                      type="button"
                      className="tk-icon-btn"
                      onClick={() => planAction("swap", task.id)}
                      aria-label="Wissel deze taak"
                      title="Wissel deze taak"
                    >
                      <SwapIcon />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
        {allDone && (
          <p className="tk-muted mt-3 text-center text-sm">Top 3 af. Alles hieronder is bonus.</p>
        )}
      </section>

      {extra.length > 0 && (
        <section>
          <h2 className="tk-h2 mb-2">Als er tijd over is</h2>
          <div className="tk-card tk-list px-3">
            {extra.map(({ task }) => (
              <div key={task.id} className="flex items-start">
                <div className="min-w-0 flex-1">
                  <TaskRow task={task} />
                </div>
                <button
                  type="button"
                  className="tk-icon-btn mt-2"
                  onClick={() => planAction("promote", task.id)}
                  aria-label="Naar de top 3"
                  title="Naar de top 3"
                >
                  <ArrowUpIcon />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {waitingDue.length > 0 && (
        <section>
          <h2 className="tk-h2 mb-2">Vandaag nabellen of nasturen</h2>
          <div className="tk-card tk-list px-3">
            {waitingDue.map((task) => (
              <TaskRow key={task.id} task={task}>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className="tk-btn tk-btn-ghost tk-btn-sm"
                    onClick={() => updateTask(task.id, { followUp: addDays(today, 3) })}
                  >
                    Gedaan, over 3 dagen weer
                  </button>
                  <button
                    type="button"
                    className="tk-btn tk-btn-ghost tk-btn-sm"
                    onClick={() => updateTask(task.id, { status: "gepland", followUp: null })}
                  >
                    Binnen
                  </button>
                </div>
              </TaskRow>
            ))}
          </div>
        </section>
      )}

      <Link
        href="/taken/afsluiten"
        className={`tk-btn ${hour >= 16 && !plan?.closedAt ? "" : "tk-btn-ghost"}`}
        style={{ alignSelf: "center" }}
      >
        {plan?.closedAt ? "Dag is afgesloten ✓" : "Dag afsluiten"}
      </Link>
    </div>
  );
}
