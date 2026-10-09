"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { blockInterval, freeMinutes, type Interval } from "@/lib/taken/agenda";
import { AREA_BY_ID, OPEN_STATUSES } from "@/lib/taken/config";
import { addDays, formatLong, formatRelative, isIsoDate, weekday } from "@/lib/taken/dates";
import { autoSchedule, type Placement } from "@/lib/taken/plan";
import { rankTasks } from "@/lib/taken/score";
import type { Task } from "@/lib/taken/types";
import CalendarGrid, { type Ghost } from "../_components/calendar/CalendarGrid";
import { useDragSource } from "../_components/calendar/DragLayer";
import { blockStartOf, durationLabel, fmt, localMs, localParts, toMinutes } from "../_components/calendar/time";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, PlayIcon, SearchIcon } from "../_components/icons";
import { anchorOf, Menu, type Anchor } from "../_components/Popover";
import QuickAdd from "../_components/QuickAdd";
import { CheckButton, focusLabel } from "../_components/TaskRow";
import { eventsOn, useAgenda, useTaken } from "../_components/TakenContext";

// Vandaag = dagplanner: links wat je gaat doen, rechts wanneer. Op mobiel wissel je tussen Lijst en Dag.

function greeting(hour: number) {
  if (hour < 6) return "Goedenacht";
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

const VIEW_KEY = "tk-today-view";
const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches;

export default function TodayPage() {
  const params = useSearchParams();
  const router = useRouter();
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
    changeTask,
    startFocus,
    notify,
    openPalette,
    workday,
  } = useTaken();
  const initial = params?.get("datum");
  const [date, setDate] = useState(isIsoDate(initial) ? (initial as string) : today);
  const [view, setView] = useState<"lijst" | "dag">("lijst");
  const [placing, setPlacing] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Placement[] | null>(null);
  const [menu, setMenu] = useState<{ anchor: Anchor; task?: Task; reason?: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const dragSource = useDragSource();
  const hour = new Date().getHours();
  const isToday = date === today;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "dag" || saved === "lijst") setView(saved);
    } catch {
      // geen opslag beschikbaar
    }
  }, []);
  const switchView = (v: "lijst" | "dag") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // geen opslag beschikbaar
    }
  };

  useEffect(() => {
    reloadPlan();
  }, [reloadPlan]);

  const { data: agenda } = useAgenda(date, date);
  const events = useMemo(() => eventsOn(agenda?.events || [], date), [agenda, date]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // Top 3 (alleen voor vandaag)
  const picks = (isToday && plan?.date === today ? plan.top3 : []).filter((p) => {
    const t = byId.get(p.id);
    return t && (OPEN_STATUSES.includes(t.status) || t.status === "af");
  });
  const pickIds = picks.map((p) => p.id);
  // Plek over in de top 3 en er zijn (nieuwe) open taken: laat de server aanvullen.
  const openCount = tasks.filter((t) => OPEN_STATUSES.includes(t.status)).length;
  useEffect(() => {
    if (plan && !plan.closedAt && isToday && picks.length < 3 && openCount > picks.length) reloadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks.length, openCount, plan?.date]);

  // Gepland op deze dag (andere dagen) en te plannen: open taken op volgorde van belang.
  const plannedThatDay = isToday ? [] : tasks.filter((t) => t.planDate === date && OPEN_STATUSES.includes(t.status));
  const toPlan = useMemo(
    () =>
      rankTasks(tasks, date, [], [...pickIds, ...(plan?.swapped || []), ...plannedThatDay.map((t) => t.id)])
        .map((s) => s.task)
        .filter((t) => !t.blockStart?.startsWith(date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, date, pickIds.join(), plan?.swapped.join(), plannedThatDay.length]
  );
  const waitingDue = isToday ? tasks.filter((t) => t.status === "wachten" && t.followUp && t.followUp <= today) : [];

  // Bezette tijd en vrije werktijd op deze dag.
  const busy: Interval[] = useMemo(
    () => [
      ...events.filter((e) => e.busy && !e.allDay).map((e) => [e.start, e.end] as Interval),
      ...tasks
        .filter((t) => t.blockStart?.startsWith(date) && t.status !== "af" && t.status !== "ooit")
        .map((t) => blockInterval(t) as Interval),
    ],
    [events, tasks, date]
  );
  const dayStart = localMs(date, toMinutes(workday.start));
  const dayEnd = localMs(date, toMinutes(workday.end));
  const from = isToday ? Math.max(Date.now(), dayStart) : dayStart;
  const free = freeMinutes(busy, dayStart, dayEnd, from);
  const isWorkday = weekday(date) >= 1 && weekday(date) <= 5;

  // ---------- Inplannen ----------
  const firstFree = (task: Task) => {
    const [slot] = autoSchedule([task], busy, Math.max(from, dayStart), localMs(date, 22 * 60));
    if (!slot) return notify("Geen vrije plek meer op deze dag");
    const p = localParts(slot.start);
    changeTask(
      task.id,
      { blockStart: blockStartOf(date, p.minutes), planDate: date, estimate: task.estimate || 30, status: task.status === "inbox" ? "gepland" : task.status },
      `${task.title} om ${fmt(p.minutes)}`
    );
  };
  const schedule = (task: Task) => {
    if (isPhone()) {
      setPlacing(task.id);
      switchView("dag");
    } else firstFree(task);
  };

  // "Plan mijn dag": top 3 eerst, dan wat er nog past.
  const planDay = () => {
    const candidates = [
      ...picks.map((p) => byId.get(p.id) as Task).filter((t) => t.status !== "af" && !t.blockStart?.startsWith(date)),
      ...(isToday ? [] : plannedThatDay.filter((t) => !t.blockStart)),
      ...toPlan,
    ].slice(0, 8);
    const placements = autoSchedule(candidates, busy, from, dayEnd);
    if (!placements.length) return notify("Er past vandaag niets meer in je werkdag");
    setProposal(placements);
    if (isPhone()) switchView("dag");
  };
  const applyPlan = () => {
    if (!proposal) return;
    const before = proposal.map((p) => {
      const t = byId.get(p.taskId) as Task;
      return { id: t.id, blockStart: t.blockStart, planDate: t.planDate, status: t.status, estimate: t.estimate };
    });
    for (const p of proposal) {
      const t = byId.get(p.taskId) as Task;
      updateTask(t.id, {
        blockStart: blockStartOf(date, localParts(p.start).minutes),
        planDate: date,
        estimate: Math.round((p.end - p.start) / 60000),
        status: t.status === "inbox" ? "gepland" : t.status,
      });
    }
    setProposal(null);
    notify(proposal.length === 1 ? "1 taak ingepland" : `${proposal.length} taken ingepland`, () =>
      before.forEach(({ id, ...rest }) => updateTask(id, rest))
    );
  };
  const ghosts: Ghost[] = (proposal || []).map((p) => {
    const s = localParts(p.start);
    return { taskId: p.taskId, day: date, start: s.minutes, end: s.minutes + Math.round((p.end - p.start) / 60000) };
  });

  // ---------- Weergave ----------
  const dateLabel = isToday ? "Vandaag" : formatRelative(date, today).replace(/^./, (c) => c.toUpperCase());
  const placingTask = placing ? byId.get(placing) : null;

  const row = (task: Task, opts: { num?: number; reason?: string } = {}) => {
    const area = task.areaId ? AREA_BY_ID[task.areaId] : null;
    const done = task.status === "af";
    const blockedToday = task.blockStart?.startsWith(date);
    return (
      <div
        key={task.id}
        className={`tk-plan-row ${done ? "is-done" : ""} ${!done ? "is-draggable" : ""}`}
        onPointerDown={(e) => !done && e.pointerType === "mouse" && dragSource(task)(e)}
      >
        {opts.num !== undefined && <span className="tk-top-num-sm">{opts.num}</span>}
        <CheckButton task={task} />
        <div className="tk-row-body" onClick={() => openTask(task.id)}>
          <div className="tk-row-title" style={done ? { color: "var(--faint)", textDecoration: "line-through" } : undefined}>
            {task.title}
          </div>
          <div className="tk-meta">
            {blockedToday && <span className="is-strong">{task.blockStart!.slice(11, 16)}</span>}
            <span>{durationLabel(task.estimate || 30)}</span>
            {area && (
              <span>
                <span className="tk-dot" style={{ background: area.color }} />
                {area.short}
              </span>
            )}
            {task.deadline && <span className={task.deadline <= today ? "is-danger" : ""}>{formatRelative(task.deadline, today)}</span>}
          </div>
          {opts.reason && <div className="tk-reason">{opts.reason}</div>}
        </div>
        {!done && (
          <div className="tk-row-actions">
            {!blockedToday && (
              <button type="button" className="tk-icon-btn" onClick={() => schedule(task)} aria-label="Inplannen" title="Inplannen">
                <CalendarIcon />
              </button>
            )}
            <button type="button" className="tk-icon-btn" onClick={() => startFocus(task.id, 25)} aria-label="Focus" title="Focus 25 min">
              <PlayIcon />
            </button>
            <button
              type="button"
              className="tk-icon-btn"
              aria-label="Meer"
              onClick={(e) => setMenu({ anchor: anchorOf(e.currentTarget), task, reason: opts.reason })}
            >
              ⋯
            </button>
          </div>
        )}
      </div>
    );
  };

  const visibleToPlan = showAll ? toPlan : toPlan.slice(0, 6);

  const list = (
    <div>
      <QuickAdd />
      {error && <div className="mt-3 text-sm" style={{ color: "var(--danger)" }}>{error}</div>}

      {isToday && (
        <section className="tk-section" style={{ marginTop: 20 }}>
          <div className="tk-section-head">
            <h2 className="tk-h2">Top 3</h2>
          </div>
          {!loaded || !plan ? (
            <div className="tk-empty">Even je dag op een rij zetten…</div>
          ) : picks.length === 0 ? (
            <div className="tk-empty">Nog niks te doen. Typ hierboven je eerste taak.</div>
          ) : (
            <div>{picks.map((p, i) => row(byId.get(p.id) as Task, { num: i + 1, reason: p.reason }))}</div>
          )}
        </section>
      )}

      {plannedThatDay.length > 0 && (
        <section className="tk-section" style={{ marginTop: 20 }}>
          <h2 className="tk-h2 mb-1">Gepland op deze dag</h2>
          <div>{plannedThatDay.map((t) => row(t))}</div>
        </section>
      )}

      {toPlan.length > 0 && (
        <section className="tk-section" style={{ marginTop: 24 }}>
          <div className="tk-section-head">
            <h2 className="tk-h2">Te plannen</h2>
            <span className="tk-faint tk-desktop-only text-xs">sleep naar de agenda</span>
          </div>
          <div>{visibleToPlan.map((t) => row(t))}</div>
          {toPlan.length > 6 && (
            <button type="button" className="tk-btn tk-btn-quiet tk-btn-sm mt-1" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Minder tonen" : `Nog ${toPlan.length - 6} tonen`}
            </button>
          )}
        </section>
      )}

      {waitingDue.length > 0 && (
        <section className="tk-section" style={{ marginTop: 24 }}>
          <h2 className="tk-h2 mb-1">Vandaag nabellen</h2>
          {waitingDue.map((task) => (
            <div key={task.id} className="tk-plan-row">
              <CheckButton task={task} />
              <div className="tk-row-body" onClick={() => openTask(task.id)}>
                <div className="tk-row-title">{task.title}</div>
                <div className="tk-meta">
                  <span>wacht op {task.waitingOn || "iemand"}</span>
                </div>
              </div>
              <div className="tk-row-actions" style={{ opacity: 1 }}>
                <button
                  type="button"
                  className="tk-btn tk-btn-quiet tk-btn-sm"
                  onClick={() => changeTask(task.id, { followUp: addDays(today, 3) }, "Over 3 dagen weer")}
                >
                  Gedaan
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );

  const grid = (
    <div>
      {placingTask && (
        <div className="tk-banner mb-2">
          <span className="min-w-0 flex-1">
            Tik op een tijd voor <strong>{placingTask.title}</strong>
          </span>
          <button
            type="button"
            className="tk-btn tk-btn-ghost tk-btn-sm"
            onClick={() => {
              firstFree(placingTask);
              setPlacing(null);
            }}
          >
            Eerste vrije plek
          </button>
          <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => setPlacing(null)}>
            Annuleer
          </button>
        </div>
      )}
      {proposal && (
        <div className="tk-banner mb-2">
          <span className="min-w-0 flex-1">
            Voorstel: {proposal.length} {proposal.length === 1 ? "taak" : "taken"} in je vrije tijd
          </span>
          <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={applyPlan}>
            Toepassen
          </button>
          <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => setProposal(null)}>
            Annuleren
          </button>
        </div>
      )}
      <CalendarGrid
        days={[date]}
        events={events}
        hourHeight={isPhone() ? 44 : 48}
        placingTaskId={placing}
        onPlaced={() => setPlacing(null)}
        ghosts={ghosts}
        layoutKey={`${Boolean(placingTask)}-${Boolean(proposal)}-${view}`}
      />
    </div>
  );

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="tk-eyebrow">{isToday ? `${greeting(hour)}, Justin` : formatLong(date).replace(/^./, (c) => c.toUpperCase())}</div>
          <div className="flex items-center gap-1">
            <h1 className="tk-h1">{isToday ? formatLong(date).replace(/^./, (c) => c.toUpperCase()) : dateLabel}</h1>
          </div>
          <div className="tk-meta mt-1" style={{ fontSize: 13 }}>
            {isWorkday && <span>{free > 0 ? `${focusLabel(free)} vrij` : "werkdag zit vol"}</span>}
            {tasks.some((t) => t.status === "inbox") && (
              <Link href="/app/taken?lijst=inbox">{tasks.filter((t) => t.status === "inbox").length} in Inbox</Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="tk-icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Vorige dag">
            <ChevronLeftIcon />
          </button>
          {!isToday && (
            <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => setDate(today)}>
              Vandaag
            </button>
          )}
          <button type="button" className="tk-icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Volgende dag">
            <ChevronRightIcon />
          </button>
          <button type="button" className="tk-btn tk-btn-sm ml-1" onClick={planDay} disabled={Boolean(proposal)}>
            Plan mijn dag
          </button>
          <button
            type="button"
            className="tk-icon-btn"
            aria-label="Meer"
            onClick={(e) => setMenu({ anchor: anchorOf(e.currentTarget) })}
          >
            ⋯
          </button>
          <button type="button" className="tk-icon-btn tk-mobile-only" onClick={() => openPalette("search")} aria-label="Zoeken">
            <SearchIcon />
          </button>
        </div>
      </header>

      <div className="tk-mobile-only mb-3">
        <div className="tk-seg" style={{ width: "100%" }}>
          <button type="button" style={{ flex: 1, justifyContent: "center" }} aria-pressed={view === "lijst"} onClick={() => switchView("lijst")}>
            Lijst
          </button>
          <button type="button" style={{ flex: 1, justifyContent: "center" }} aria-pressed={view === "dag"} onClick={() => switchView("dag")}>
            Dag
          </button>
        </div>
      </div>

      <div className="tk-planner">
        <div className={`tk-planner-side ${view === "dag" ? "tk-desktop-only" : ""}`}>{list}</div>
        <div className={view === "lijst" ? "tk-desktop-only" : ""}>{grid}</div>
      </div>

      {menu && (
        <Menu
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          items={
            menu.task
              ? [
                  ...(menu.reason ? [{ label: "Waarom deze?", hint: "", onSelect: () => notify(menu.reason as string) }] : []),
                  { label: "Inplannen", onSelect: () => schedule(menu.task as Task) },
                  {
                    label: "Naar morgen",
                    onSelect: () =>
                      changeTask((menu.task as Task).id, { planDate: addDays(today, 1), blockStart: null }, "Naar morgen verplaatst"),
                  },
                  ...(pickIds.includes(menu.task.id) && !plan?.closedAt
                    ? [{ label: "Wissel uit top 3", onSelect: () => planAction("swap", (menu.task as Task).id) }]
                    : isToday && !plan?.closedAt
                    ? [{ label: "Naar de top 3", onSelect: () => planAction("promote", (menu.task as Task).id) }]
                    : []),
                  { label: "Details", onSelect: () => openTask((menu.task as Task).id) },
                ]
              : [
                  ...(isToday && plan && !plan.closedAt ? [{ label: "Top 3 opnieuw kiezen", onSelect: () => planAction("recompute") }] : []),
                  { label: "Dag afsluiten", onSelect: () => router.push("/app/afsluiten") },
                  { label: "Weekreview", onSelect: () => router.push("/app/review") },
                  { label: "Instellingen", onSelect: () => router.push("/app/instellingen") },
                ]
          }
        />
      )}
    </div>
  );
}
