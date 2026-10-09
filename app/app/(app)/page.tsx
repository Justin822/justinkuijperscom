"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { blockInterval, freeMinutes } from "@/lib/taken/agenda";
import { OPEN_STATUSES } from "@/lib/taken/config";
import { addDays, formatLong, weekday } from "@/lib/taken/dates";
import { rankTasks } from "@/lib/taken/score";
import type { Task } from "@/lib/taken/types";
import { ArrowUpIcon, PlayIcon, SwapIcon } from "../_components/icons";
import PageHeader from "../_components/PageHeader";
import QuickAdd from "../_components/QuickAdd";
import TaskRow, { CheckButton, focusLabel, TaskMeta } from "../_components/TaskRow";
import { eventsOn, useAgenda, useTaken } from "../_components/TakenContext";

function greeting(hour: number) {
  if (hour < 6) return "Goedenacht";
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
const at = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();

export default function TodayPage() {
  const {
    tasks,
    loaded,
    error,
    today,
    plan,
    reloadPlan,
    planAction,
    openTask,
    updateTask,
    addRef,
    startFocus,
    focus,
    workday: WORKDAY,
  } = useTaken();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const hour = new Date(now).getHours();

  useEffect(() => {
    reloadPlan();
  }, [reloadPlan]);

  const { data: agenda } = useAgenda(today, today);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const isActive = (t?: Task) => Boolean(t && (OPEN_STATUSES.includes(t.status) || t.status === "af"));
  const picks = (plan?.date === today ? plan.top3 : []).filter((p) => isActive(byId.get(p.id)));
  const pickIds = picks.map((p) => p.id);

  const extra = useMemo(
    () => rankTasks(tasks, today, [], [...pickIds, ...(plan?.swapped || [])]).slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, today, pickIds.join(), plan?.swapped.join()]
  );

  // Een plek vrijgekomen of net een taak toegevoegd: laat de server aanvullen.
  const openPicks = picks.filter((p) => byId.get(p.id)?.status !== "af").length;
  useEffect(() => {
    if (plan && !plan.closedAt && picks.length < 3 && extra.length > 0) reloadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks.length, extra.length]);

  // Agenda van vandaag: afspraken + timeblocks, en hoeveel werktijd er nog vrij is.
  const events = eventsOn(agenda?.events || [], today);
  const blocks = tasks.filter((t) => t.blockStart?.startsWith(today) && t.status !== "wachten" && t.status !== "ooit");
  const timeline = [
    ...events.filter((e) => !e.allDay).map((e) => ({ id: e.id, start: e.start, end: e.end, title: e.title, task: null as Task | null })),
    ...blocks.map((t) => {
      const [start, end] = blockInterval(t) as [number, number];
      return { id: t.id, start, end, title: t.title, task: t };
    }),
  ].sort((a, b) => a.start - b.start);
  const allDay = events.filter((e) => e.allDay);
  const isWorkday = weekday(today) >= 1 && weekday(today) <= 5;
  const free =
    agenda?.configured || blocks.length
      ? freeMinutes(
          [
            ...events.filter((e) => e.busy).map((e) => [e.start, e.end] as [number, number]),
            ...blocks.filter((t) => t.status !== "af").map((t) => blockInterval(t) as [number, number]),
          ],
          at(today, WORKDAY.start),
          at(today, WORKDAY.end),
          now
        )
      : null;

  const waitingDue = tasks
    .filter((t) => t.status === "wachten" && t.followUp && t.followUp <= today)
    .sort((a, b) => (a.followUp || "").localeCompare(b.followUp || ""));
  const inboxCount = tasks.filter((t) => t.status === "inbox").length;
  const openCount = tasks.filter((t) => OPEN_STATUSES.includes(t.status)).length;
  const allDone = picks.length > 0 && openPicks === 0;
  const isFriday = weekday(today) === 5;

  return (
    <div>
      <PageHeader eyebrow={formatLong(today)} title={`${greeting(hour)}, Justin`} />
      <QuickAdd />

      <div className="tk-meta mt-3" style={{ fontSize: 13 }}>
        <Link href="/app/taken?lijst=inbox" className={inboxCount ? "is-strong" : ""}>
          {inboxCount} in Inbox
        </Link>
        {waitingDue.length > 0 && (
          <Link href="/app/taken?lijst=wachten" className="is-warn">
            {waitingDue.length} nabellen
          </Link>
        )}
        {free !== null && isWorkday && (
          <span>{free > 0 ? `${focusLabel(free)} vrij tot ${WORKDAY.end}` : "Geen vrije werktijd meer"}</span>
        )}
      </div>

      {error && (
        <div className="mt-4 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}

      <section className="tk-section">
        <div className="tk-section-head">
          <h2 className="tk-h2">Top 3</h2>
          {plan && picks.length > 0 && !plan.closedAt && (
            <button type="button" className="tk-btn tk-btn-quiet tk-btn-sm" onClick={() => planAction("recompute")}>
              Opnieuw kiezen
            </button>
          )}
        </div>
        {!loaded || !plan ? (
          <div className="tk-empty">Even je dag op een rij zetten…</div>
        ) : picks.length === 0 ? (
          <div className="tk-empty">
            {openCount === 0 ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 550, color: "var(--text)" }}>Nog niks te doen</div>
                <p className="mt-1">Typ hierboven je eerste taak, bijvoorbeeld</p>
                <p className="mt-1" style={{ color: "var(--muted)" }}>
                  Offerte Jansen vrijdag, Appèl, half uur
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
          <div>
            {picks.map((p, i) => {
              const task = byId.get(p.id) as Task;
              const done = task.status === "af";
              const focusing = focus?.taskId === task.id;
              return (
                <div key={p.id} className={`tk-top ${done ? "is-done" : ""}`}>
                  <span className="tk-top-num">{i + 1}</span>
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openTask(task.id)}>
                    <div className="tk-top-title">{task.title}</div>
                    <div className="tk-top-reason">{p.reason}</div>
                    <TaskMeta task={task} />
                  </div>
                  <div className="tk-top-actions">
                    {!done && (
                      <button
                        type="button"
                        className={`tk-icon-btn ${focusing ? "is-on" : ""}`}
                        onClick={() => startFocus(task.id, 25)}
                        aria-label="Focus 25 minuten"
                        title="Focus 25 min"
                      >
                        <PlayIcon />
                      </button>
                    )}
                    {!done && !plan?.closedAt && (
                      <button
                        type="button"
                        className="tk-icon-btn"
                        onClick={() => planAction("swap", task.id)}
                        aria-label="Wissel deze taak"
                        title="Wissel"
                      >
                        <SwapIcon />
                      </button>
                    )}
                    <div className="ml-1 mt-1.5">
                      <CheckButton task={task} />
                    </div>
                  </div>
                </div>
              );
            })}
            {allDone && <p className="tk-muted mt-3 text-sm">Top 3 af. Alles hieronder is bonus.</p>}
          </div>
        )}
      </section>

      {(timeline.length > 0 || allDay.length > 0 || agenda?.configured) && (
        <section className="tk-section">
          <div className="tk-section-head">
            <h2 className="tk-h2">Agenda</h2>
            <Link href="/app/agenda" className="tk-btn tk-btn-quiet tk-btn-sm">
              Plannen
            </Link>
          </div>
          {allDay.map((e) => (
            <div key={e.id} className="tk-agenda-row">
              <span className="tk-time">hele dag</span>
              <span>{e.title}</span>
            </div>
          ))}
          {timeline.length === 0 && allDay.length === 0 && <div className="tk-muted py-2 text-sm">Geen afspraken vandaag.</div>}
          {timeline.map((item) => (
            <div
              key={item.id}
              className={`tk-agenda-row ${item.end < now || item.task?.status === "af" ? "is-past" : ""}`}
              onClick={item.task ? () => openTask(item.task!.id) : undefined}
              style={item.task ? { cursor: "pointer" } : undefined}
            >
              <span className="tk-time">
                {hhmm(item.start)}–{hhmm(item.end)}
              </span>
              <span className={item.task ? "font-medium" : ""}>
                {item.task ? "▪ " : ""}
                {item.title}
              </span>
            </div>
          ))}
        </section>
      )}

      {extra.length > 0 && (
        <section className="tk-section">
          <div className="tk-section-head">
            <h2 className="tk-h2">Als er tijd over is</h2>
          </div>
          <div className="tk-list">
            {extra.map(({ task }) => (
              <TaskRow
                key={task.id}
                task={task}
                actions={
                  <button
                    type="button"
                    className="tk-icon-btn"
                    onClick={() => planAction("promote", task.id)}
                    aria-label="Naar de top 3"
                    title="Naar de top 3"
                  >
                    <ArrowUpIcon />
                  </button>
                }
              />
            ))}
          </div>
        </section>
      )}

      {waitingDue.length > 0 && (
        <section className="tk-section">
          <div className="tk-section-head">
            <h2 className="tk-h2">Vandaag nabellen of nasturen</h2>
          </div>
          <div className="tk-list">
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
                    className="tk-btn tk-btn-quiet tk-btn-sm"
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

      <div className="mt-10 flex flex-wrap justify-center gap-2">
        <Link href="/app/afsluiten" className={`tk-btn ${hour >= 16 && !plan?.closedAt ? "" : "tk-btn-ghost"}`}>
          {plan?.closedAt ? "Dag is afgesloten" : "Dag afsluiten"}
        </Link>
        <Link href="/app/review" className={`tk-btn ${isFriday && hour >= 14 ? "" : "tk-btn-ghost"}`}>
          Weekreview
        </Link>
      </div>
    </div>
  );
}
