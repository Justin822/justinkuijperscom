"use client";

import { useState } from "react";
import { AREA_BY_ID } from "@/lib/taken/config";
import { formatRelative } from "@/lib/taken/dates";
import type { CalendarEvent, Task } from "@/lib/taken/types";
import { CheckIcon, PlayIcon, TrashIcon } from "../icons";
import Popover, { type Anchor } from "../Popover";
import { useTaken } from "../TakenContext";
import { blockStartOf, durationLabel, fmt, localParts, toMinutes } from "./time";


export type Block = {
  id: string;
  kind: "task" | "event";
  day: string;
  start: number;
  end: number;
  task?: Task;
  event?: CalendarEvent;
};

const DURATIONS = [15, 30, 45, 60, 90, 120];

/** Venstertje bij een blok in de agenda: snel afvinken, duur kiezen, focussen of details openen. */
export default function BlockPopover({ block, anchor, onClose }: { block: Block; anchor: Anchor; onClose: () => void }) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={320} label={block.kind === "task" ? "Taak" : "Afspraak"}>
      {block.kind === "task" ? (
        <TaskContent taskId={block.id} onClose={onClose} />
      ) : (
        <EventContent event={block.event as CalendarEvent} day={block.day} onClose={onClose} />
      )}
    </Popover>
  );
}

function TaskContent({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { tasks, today, changeTask, updateTask, removeTask, addTasks, notify, openTask, startFocus } = useTaken();
  const task = tasks.find((t) => t.id === taskId);
  const [title, setTitle] = useState(task?.title || "");
  if (!task) return null;
  const done = task.status === "af";
  const area = task.areaId ? AREA_BY_ID[task.areaId] : null;
  const start = task.blockStart ? toMinutes(task.blockStart.slice(11, 16)) : null;
  const dur = task.estimate || 30;

  const saveTitle = () => {
    const value = title.trim();
    if (value && value !== task.title) updateTask(task.id, { title: value });
  };

  return (
    <div className="tk-pop-body">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          className={`tk-check ${done ? "is-on" : ""}`}
          style={{ marginTop: 3 }}
          aria-label={done ? "Weer openzetten" : "Afvinken"}
          onClick={() =>
            done
              ? updateTask(task.id, { status: task.areaId ? "gepland" : "inbox" })
              : changeTask(task.id, { status: "af" }, "Afgevinkt")
          }
        >
          <CheckIcon />
        </button>
        <input
          className="tk-input-bare"
          style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              saveTitle();
              onClose();
            }
          }}
          aria-label="Titel"
        />
      </div>

      <div className="tk-muted mt-1.5 pl-[30px] text-[13px]">
        {start !== null && task.blockStart
          ? `${formatRelative(task.blockStart.slice(0, 10), today)} · ${fmt(start)}–${fmt(Math.min(start + dur, 1440))}`
          : task.planDate
          ? `${formatRelative(task.planDate, today)} · nog geen tijd`
          : "Geen tijd"}
        {area && (
          <>
            {" · "}
            <span className="tk-dot" style={{ background: area.color, verticalAlign: "middle", marginRight: 4 }} />
            {area.short}
          </>
        )}
      </div>

      <div className="tk-seg mt-3" role="group" aria-label="Duur">
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={dur === m}
            onClick={() => changeTask(task.id, { estimate: m }, `Duur: ${durationLabel(m)}`)}
          >
            {m < 60 ? `${m}m` : m === 90 ? "1½u" : `${m / 60}u`}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {!done && (
          <button
            type="button"
            className="tk-btn tk-btn-sm"
            onClick={() => {
              onClose();
              startFocus(task.id, Math.min(dur, 90));
            }}
          >
            <PlayIcon className="h-3 w-3" /> Focus
          </button>
        )}
        {task.blockStart && (
          <button
            type="button"
            className="tk-btn tk-btn-ghost tk-btn-sm"
            onClick={() => {
              onClose();
              changeTask(task.id, { blockStart: null }, "Uit de agenda gehaald");
            }}
          >
            Uit agenda
          </button>
        )}
        <button
          type="button"
          className="tk-btn tk-btn-ghost tk-btn-sm"
          onClick={() => {
            onClose();
            openTask(task.id);
          }}
        >
          Details
        </button>
        <button
          type="button"
          className="tk-icon-btn ml-auto"
          aria-label="Verwijderen"
          onClick={() => {
            onClose();
            removeTask(task.id);
            const { id: _id, createdAt, updatedAt, doneAt, googleEventId, ...copy } = task;
            notify("Taak verwijderd", () => addTasks([copy]));
          }}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function EventContent({ event, day, onClose }: { event: CalendarEvent; day: string; onClose: () => void }) {
  const { addTasks, notify, today } = useTaken();
  const s = localParts(event.start);
  const e = localParts(event.end);
  const when = event.allDay
    ? "Hele dag"
    : `${formatRelative(s.date, today)} · ${fmt(s.minutes)}–${fmt(e.date === s.date ? e.minutes : 1440)}`;

  const prepare = async () => {
    onClose();
    const startMin = event.allDay ? null : Math.max(0, s.minutes - 30);
    await addTasks([
      {
        title: `Voorbereiden: ${event.title}`,
        planDate: day,
        estimate: 15,
        status: "gepland",
        blockStart: startMin !== null && s.date === day ? blockStartOf(day, startMin) : null,
      },
    ]);
    notify("Voorbereidingstaak toegevoegd");
  };

  return (
    <div className="tk-pop-body">
      <div className="flex items-center gap-2 text-xs tk-muted">
        <span className="tk-dot" style={{ background: event.color || "var(--faint)" }} />
        {event.calendar}
      </div>
      <div className="mt-1" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
        {event.title}
      </div>
      <div className="tk-muted mt-1 text-[13px]">{when}</div>
      {event.location && <div className="tk-muted mt-1 text-[13px]">{event.location}</div>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {event.meetUrl && (
          <a className="tk-btn tk-btn-sm" href={event.meetUrl} target="_blank" rel="noreferrer">
            Deelnemen
          </a>
        )}
        {event.link && (
          <a className="tk-btn tk-btn-ghost tk-btn-sm" href={event.link} target="_blank" rel="noreferrer">
            Open in Google Agenda
          </a>
        )}
        <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={prepare}>
          Voorbereiden als taak
        </button>
      </div>
    </div>
  );
}
