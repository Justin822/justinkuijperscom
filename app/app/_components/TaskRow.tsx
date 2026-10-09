"use client";

import { AREA_BY_ID, estimateLabel } from "@/lib/taken/config";
import { diffDays, formatRelative } from "@/lib/taken/dates";
import type { Task } from "@/lib/taken/types";
import { CheckIcon, MailIcon } from "./icons";
import { useTaken } from "./TakenContext";

export function TaskMeta({ task, hideArea }: { task: Task; hideArea?: boolean }) {
  const { today } = useTaken();
  const area = task.areaId ? AREA_BY_ID[task.areaId] : null;
  const chips: React.ReactNode[] = [];

  if (area && !hideArea)
    chips.push(
      <span key="area" className="tk-chip">
        <span className="tk-dot" style={{ background: area.color }} />
        {area.short}
        {task.project ? ` / ${task.project}` : ""}
      </span>
    );
  if (!area && task.project) chips.push(<span key="project" className="tk-chip">{task.project}</span>);
  if (task.deadline) {
    const days = diffDays(today, task.deadline);
    const tone = days < 0 || (task.deadlineHard && days <= 1) ? "tk-chip-danger" : days <= 2 ? "tk-chip-warn" : "";
    chips.push(
      <span key="deadline" className={`tk-chip ${tone}`}>
        {task.deadlineHard ? "⚑ " : ""}
        {days < 0 ? `te laat · ${formatRelative(task.deadline, today)}` : formatRelative(task.deadline, today)}
      </span>
    );
  }
  if (task.planDate && task.planDate !== task.deadline)
    chips.push(
      <span key="plan" className="tk-chip">
        doen {formatRelative(task.planDate, today)}
      </span>
    );
  if (task.estimate) chips.push(<span key="est" className="tk-chip">{estimateLabel(task.estimate)}</span>);
  if (task.impact === "hoog") chips.push(<span key="impact" className="tk-chip tk-chip-accent">hoge impact</span>);
  if (task.status === "bezig") chips.push(<span key="bezig" className="tk-chip tk-chip-accent">bezig</span>);
  if (task.status === "wachten")
    chips.push(
      <span
        key="wachten"
        className={`tk-chip ${task.followUp && task.followUp <= today ? "tk-chip-warn" : ""}`}
      >
        wacht op {task.waitingOn || "iemand"}
        {task.followUp ? ` · nabellen ${formatRelative(task.followUp, today)}` : ""}
      </span>
    );
  if (task.postponed > 0)
    chips.push(
      <span key="postponed" className={`tk-chip ${task.postponed >= 3 ? "tk-chip-danger" : ""}`}>
        ↻ {task.postponed}×
      </span>
    );
  if (task.mailLink)
    chips.push(
      <a
        key="mail"
        className="tk-chip tk-chip-accent"
        href={task.mailLink}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        <MailIcon className="h-3 w-3" /> mail
      </a>
    );

  return chips.length ? <div className="tk-row-meta">{chips}</div> : null;
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
          notify("Afgevinkt", () => updateTask(task.id, { status: previous }));
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
}: {
  task: Task;
  hideArea?: boolean;
  children?: React.ReactNode;
}) {
  const { openTask } = useTaken();
  return (
    <div className={`tk-row ${task.status === "af" ? "is-done" : ""}`}>
      <CheckButton task={task} />
      <div className="tk-row-body" onClick={() => openTask(task.id)}>
        <div className="tk-row-title">{task.title}</div>
        <TaskMeta task={task} hideArea={hideArea} />
        {children && (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
