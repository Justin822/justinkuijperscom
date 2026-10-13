"use client";

import { memo, useCallback, useRef } from "react";
import { estimateLabel } from "@/lib/taken/config";
import { addDays, diffDays, formatRelative } from "@/lib/taken/dates";
import { repeatLabel } from "@/lib/taken/repeat";
import { isOutside, SOURCE_LABEL, sourceLink } from "@/lib/taken/source";
import type { Task } from "@/lib/taken/types";
import { CheckIcon } from "./icons";
import { useAreas, useTakenActions, useToday } from "./TakenContext";

export const focusLabel = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}u${m % 60 ? ` ${m % 60}m` : ""}` : `${m} min`);

/** Eén gedempte regel: ● Appèl / Leadgen · vr 16 okt · 30 min · ↻ elke maandag */
// memo + alleen useToday: een regel tekent alleen opnieuw als zijn eigen taak verandert.
export const TaskMeta = memo(function TaskMeta({ task, hideArea }: { task: Task; hideArea?: boolean }) {
  const { map: areaById } = useAreas();
  const today = useToday();
  const area = task.areaId ? areaById[task.areaId] : null;
  const parts: React.ReactNode[] = [];

  if (area && !hideArea)
    parts.push(
      <span key="area">
        <span className="tk-dot" style={{ background: area.color }} />
        {area.short}
        {task.project ? ` / ${task.project}` : ""}
      </span>
    );
  else if (task.project) parts.push(<span key="project">{task.project}</span>);
  if (task.deadline) {
    const days = diffDays(today, task.deadline);
    const tone = days < 0 || (task.deadlineHard && days <= 1) ? "is-danger" : days <= 1 ? "is-warn" : "";
    parts.push(
      <span key="deadline" className={tone}>
        {days < 0 ? "te laat, " : ""}
        {task.deadlineHard ? "uiterlijk " : ""}
        {formatRelative(task.deadline, today)}
      </span>
    );
  }
  if (task.blockStart)
    parts.push(
      <span key="block" className="is-strong">
        {task.blockStart.startsWith(today) ? "" : `${formatRelative(task.blockStart.slice(0, 10), today)} `}
        {task.blockStart.slice(11, 16)}
      </span>
    );
  else if (task.planDate && task.planDate !== task.deadline && task.planDate !== today)
    parts.push(<span key="plan">doen {formatRelative(task.planDate, today)}</span>);
  if (task.estimate) parts.push(<span key="est">{estimateLabel(task.estimate)}</span>);
  if (task.repeat) parts.push(<span key="repeat">↻ {repeatLabel(task.repeat)}</span>);
  if (task.impact === "hoog") parts.push(<span key="impact" className="is-strong">hoge impact</span>);
  if (task.status === "bezig") parts.push(<span key="bezig" className="is-strong">bezig</span>);
  if (task.status === "wachten")
    parts.push(
      <span key="wachten" className={task.followUp && task.followUp <= today ? "is-warn" : ""}>
        wacht op {task.waitingOn || "iemand"}
        {task.followUp ? `, nabellen ${formatRelative(task.followUp, today)}` : ""}
      </span>
    );
  if (task.postponed > 0)
    parts.push(
      <span key="postponed" className={task.postponed >= 3 ? "is-danger" : ""}>
        {task.postponed}× doorgeschoven
      </span>
    );
  if (task.focusMinutes > 0) parts.push(<span key="focus">{focusLabel(task.focusMinutes)} gefocust</span>);
  // Herkomst: van buiten de app (mail, gedeeld, snelknop) met een link terug als die er is.
  const link = sourceLink(task);
  if (isOutside(task.source) || link) {
    const label = isOutside(task.source) ? SOURCE_LABEL[task.source] : "link";
    parts.push(
      link ? (
        <a key="src" className="tk-src" href={link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          {label} ↗
        </a>
      ) : (
        <span key="src" className="tk-src">
          {label}
        </span>
      )
    );
  }

  return parts.length ? <div className="tk-meta">{parts}</div> : null;
});

/** Afvinken met een korte trilling en "Ongedaan maken" (voor het rondje én vegen naar rechts). */
function useCheckOff() {
  const { updateTask, notify } = useTakenActions();
  return useCallback(
    (task: Task) => {
      const previous = task.status;
      navigator.vibrate?.(12);
      updateTask(task.id, { status: "af" });
      notify(task.repeat ? "Afgevinkt, de volgende staat klaar" : "Afgevinkt", () => updateTask(task.id, { status: previous }));
    },
    [updateTask, notify]
  );
}

export const CheckButton = memo(function CheckButton({ task }: { task: Task }) {
  const { updateTask } = useTakenActions();
  const checkOff = useCheckOff();
  const done = task.status === "af";
  return (
    <button
      type="button"
      className={`tk-check ${done ? "is-on" : ""}`}
      aria-label={done ? "Weer openzetten" : "Afvinken"}
      onClick={(e) => {
        e.stopPropagation();
        if (done) updateTask(task.id, { status: task.areaId ? "gepland" : "inbox" });
        else checkOff(task);
      }}
    >
      <CheckIcon />
    </button>
  );
});

const SWIPE = 84;

/**
 * Vegen op een telefoon: naar rechts vinkt af, naar links schuift naar morgen.
 * Alleen bij een duidelijk horizontale beweging; verticaal blijft gewoon scrollen.
 */
function useSwipe(task: Task) {
  const today = useToday();
  const { changeTask } = useTakenActions();
  const checkOff = useCheckOff();
  const ref = useRef<HTMLDivElement>(null);
  const enabled = task.status !== "af";

  const onPointerDown = (e: React.PointerEvent) => {
    const row = ref.current;
    if (!enabled || !row || e.pointerType !== "touch") return;
    if ((e.target as HTMLElement).closest("button, input, textarea, select, a")) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let mode: "?" | "x" | "y" = "?";
    let dx = 0;
    const set = (value: number) => {
      row.style.setProperty("--swipe", `${value}px`);
      row.dataset.swipe = value > SWIPE ? "af" : value < -SWIPE ? "morgen" : "";
    };
    const move = (ev: PointerEvent) => {
      const mx = ev.clientX - x0;
      const my = ev.clientY - y0;
      if (mode === "?") {
        if (Math.abs(my) > 10) mode = "y";
        else if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) {
          mode = "x";
          row.classList.add("is-swiping");
        }
      }
      if (mode !== "x") return;
      dx = Math.max(-140, Math.min(140, mx));
      set(dx);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (mode !== "x") return;
      row.classList.remove("is-swiping");
      set(0);
      // De klik die na het loslaten volgt mag de taak niet openen.
      window.addEventListener("click", (ev) => ev.stopPropagation(), { capture: true, once: true });
      setTimeout(() => row.removeAttribute("data-swipe"), 200);
      if (dx > SWIPE) checkOff(task);
      else if (dx < -SWIPE) {
        navigator.vibrate?.(12);
        changeTask(task.id, { planDate: addDays(today, 1), blockStart: null }, "Naar morgen");
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  return { ref, onPointerDown };
}

export default function TaskRow({
  task,
  hideArea,
  children,
  actions,
  onOpen,
}: {
  task: Task;
  hideArea?: boolean;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  /** Wat een tik op de taak doet; standaard de taak openen. */
  onOpen?: () => void;
}) {
  const { openTask } = useTakenActions();
  const swipe = useSwipe(task);
  return (
    <div ref={swipe.ref} onPointerDown={swipe.onPointerDown} className={`tk-row ${task.status === "af" ? "is-done" : ""}`}>
      <CheckButton task={task} />
      <div
        className="tk-row-body"
        role="button"
        tabIndex={0}
        aria-label={`${task.title}: openen`}
        onClick={onOpen || (() => openTask(task.id))}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
            e.preventDefault();
            (onOpen || (() => openTask(task.id)))();
          }
        }}
      >
        <div className="tk-row-title">{task.title}</div>
        <TaskMeta task={task} hideArea={hideArea} />
        {children && (
          <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
            {children}
          </div>
        )}
      </div>
      {actions && <div className="-my-1 flex items-center">{actions}</div>}
    </div>
  );
}
