"use client";

import { AREA_BY_ID, estimateLabel } from "@/lib/taken/config";
import { diffDays, formatRelative } from "@/lib/taken/dates";
import { repeatLabel } from "@/lib/taken/repeat";
import type { Task } from "@/lib/taken/types";
import { CheckIcon } from "./icons";
import { useTaken } from "./TakenContext";

export const focusLabel = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}u${m % 60 ? ` ${m % 60}m` : ""}` : `${m} min`);

/** Eén gedempte regel: ● Appèl / Leadgen · vr 16 okt · 30 min · ↻ elke maandag */
export function TaskMeta({ task, hideArea }: { task: Task; hideArea?: boolean }) {
  const { today } = useTaken();
  const area = task.areaId ? AREA_BY_ID[task.areaId] : null;
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
  if (task.mailLink)
    parts.push(
      <a key="mail" href={task.mailLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        mail
      </a>
    );

  return parts.length ? <div className="tk-meta">{parts}</div> : null;
}

export function CheckButton({ task }: { task: Task }) {
  const { updateTask, notify } = useTaken();
  const done = task.status === "af";
  return (
    <button
      type="button"
      className={`tk-check ${done ? "is-on" : ""}`}
      aria-label={done ? "Weer openzetten" : "Afvinken"}
      onClick={(e) => {
        e.stopPropagation();
        if (done) {
          updateTask(task.id, { status: task.areaId ? "gepland" : "inbox" });
        } else {
          const previous = task.status;
          updateTask(task.id, { status: "af" });
          notify(task.repeat ? "Afgevinkt, de volgende staat klaar" : "Afgevinkt", () =>
            updateTask(task.id, { status: previous })
          );
        }
      }}
    >
      <CheckIcon />
    </button>
  );
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
  const { openTask } = useTaken();
  return (
    <div className={`tk-row ${task.status === "af" ? "is-done" : ""}`}>
      <CheckButton task={task} />
      <div className="tk-row-body" onClick={onOpen || (() => openTask(task.id))}>
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
