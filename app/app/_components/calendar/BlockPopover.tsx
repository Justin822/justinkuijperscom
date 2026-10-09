"use client";

import { useState } from "react";
import { AREA_BY_ID } from "@/lib/taken/config";
import { formatRelative } from "@/lib/taken/dates";
import type { CalendarEvent, Task } from "@/lib/taken/types";
import { CheckIcon, PlayIcon, TrashIcon } from "../icons";
import Popover, { type Anchor } from "../Popover";
import { useTaken } from "../TakenContext";
import { blockStartOf, durationLabel, fmt, localParts, toMinutes } from "./time";
import { movable, useEvents } from "./useEvents";

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
const durationShort = (m: number) => (m < 60 ? `${m}m` : m === 90 ? "1½u" : `${m / 60}u`);

type EventHandlers = {
  /** Nieuwe tijd voor een afspraak (de agenda vraagt zo nodig of gasten een mail krijgen). */
  onEventTime?: (event: CalendarEvent, start: number, end: number, message: string) => void;
  onEventDelete?: (event: CalendarEvent) => void;
};

/** Venstertje bij een blok in de agenda: snel afvinken, duur kiezen, focussen of details openen. */
export default function BlockPopover({
  block,
  anchor,
  onClose,
  ...handlers
}: { block: Block; anchor: Anchor; onClose: () => void } & EventHandlers) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={320} label={block.kind === "task" ? "Taak" : "Afspraak"}>
      {block.kind === "task" ? (
        <TaskContent taskId={block.id} onClose={onClose} />
      ) : (
        <EventContent event={block.event as CalendarEvent} day={block.day} onClose={onClose} {...handlers} />
      )}
    </Popover>
  );
}

/** Afspraak met gasten verplaatst of verwijderd: krijgen zij een mail? */
export function GuestConfirm({
  anchor,
  kind,
  event,
  onChoose,
  onCancel,
}: {
  anchor: Anchor;
  kind: "move" | "delete";
  event: CalendarEvent;
  onChoose: (mail: boolean) => void;
  onCancel: () => void;
}) {
  const guests = `${event.guests} ${event.guests === 1 ? "gast" : "gasten"}`;
  return (
    <Popover anchor={anchor} onClose={onCancel} width={300} label="Gasten">
      <div className="tk-pop-body">
        <div style={{ fontSize: 15, fontWeight: 600 }}>{kind === "move" ? "Gasten laten weten?" : "Afspraak verwijderen?"}</div>
        <p className="tk-muted mt-1 text-[13px]">
          {event.title} heeft {guests}.{" "}
          {kind === "move" ? "Wil je ze mailen over de nieuwe tijd?" : "Wil je ze een afmelding mailen?"}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" className="tk-btn tk-btn-sm" onClick={() => onChoose(true)}>
            {kind === "move" ? "Mail sturen" : "Verwijderen en mailen"}
          </button>
          <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => onChoose(false)}>
            {kind === "move" ? "Niet mailen" : "Zonder mail"}
          </button>
          <button type="button" className="tk-btn tk-btn-quiet tk-btn-sm" onClick={onCancel}>
            Annuleren
          </button>
        </div>
      </div>
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
            {durationShort(m)}
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

function EventContent({
  event,
  day,
  onClose,
  onEventTime,
  onEventDelete,
}: { event: CalendarEvent; day: string; onClose: () => void } & EventHandlers) {
  const { addTasks, notify, today, settings } = useTaken();
  const { update } = useEvents();
  const [title, setTitle] = useState(event.title);
  const s = localParts(event.start);
  const e = localParts(event.end);
  const minutes = Math.round((event.end - event.start) / 60000);
  const when = event.allDay
    ? "Hele dag"
    : `${formatRelative(s.date, today)} · ${fmt(s.minutes)}–${fmt(e.date === s.date ? e.minutes : 1440)}`;
  const canMove = movable(event) && Boolean(onEventTime);

  const saveTitle = () => {
    const value = title.trim();
    if (event.editable && value && value !== event.title) update(event, { title: value }, "Titel aangepast");
  };

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

  // Waarom je deze afspraak niet kunt aanpassen, in één regel.
  const readOnly =
    event.source === "ics"
      ? "Alleen lezen (iCal-link)"
      : event.organizer
      ? `Uitnodiging van ${event.organizer}`
      : !event.editable && settings?.google.connected && !settings.google.canEdit
      ? "reconnect"
      : !event.editable && event.eventId
      ? "Alleen lezen"
      : null;

  return (
    <div className="tk-pop-body">
      <div className="flex items-center gap-2 text-xs tk-muted">
        <span className="tk-dot" style={{ background: event.color || "var(--faint)" }} />
        {event.calendar}
        {event.recurring && <span>· herhaalt</span>}
      </div>
      {event.editable ? (
        <input
          className="tk-input-bare mt-1"
          style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}
          value={title}
          onChange={(ev) => setTitle(ev.target.value)}
          onBlur={saveTitle}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              saveTitle();
              onClose();
            }
          }}
          aria-label="Titel van de afspraak"
        />
      ) : (
        <div className="mt-1" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {event.title}
        </div>
      )}
      <div className="tk-muted mt-1 text-[13px]">{when}</div>
      {event.location && <div className="tk-muted mt-1 text-[13px]">{event.location}</div>}

      {canMove && (
        <div className="tk-seg mt-3" role="group" aria-label="Duur">
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={minutes === m}
              onClick={() => {
                onClose();
                onEventTime?.(event, event.start, event.start + m * 60000, `Duur: ${durationLabel(m)}`);
              }}
            >
              {durationShort(m)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {event.meetUrl && (
          <a className="tk-btn tk-btn-sm" href={event.meetUrl} target="_blank" rel="noreferrer">
            Deelnemen
          </a>
        )}
        {event.link && (
          <a className="tk-btn tk-btn-ghost tk-btn-sm" href={event.link} target="_blank" rel="noreferrer">
            Open in Google
          </a>
        )}
        <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={prepare}>
          Voorbereiden als taak
        </button>
        {event.editable && onEventDelete && (
          <button
            type="button"
            className="tk-icon-btn ml-auto"
            aria-label="Afspraak verwijderen"
            onClick={() => {
              onClose();
              onEventDelete(event);
            }}
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {(readOnly || (event.editable && event.recurring)) && (
        <p className="tk-faint mt-3 text-xs">
          {readOnly === "reconnect" ? (
            <>
              Bewerken kan na{" "}
              <a href="/app/instellingen" className="underline">
                opnieuw koppelen
              </a>
              .
            </>
          ) : (
            readOnly || "Wijzigingen gelden alleen voor deze keer."
          )}
        </p>
      )}
    </div>
  );
}
