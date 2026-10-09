"use client";

import { useMemo, useState } from "react";
import { blockInterval, firstFreeSlot, freeMinutes, WORKDAY } from "@/lib/taken/agenda";
import { estimateLabel, OPEN_STATUSES } from "@/lib/taken/config";
import { addDays, formatLong, MONTHS, weekday, WEEKDAYS_SHORT } from "@/lib/taken/dates";
import { rankTasks } from "@/lib/taken/score";
import type { Task } from "@/lib/taken/types";
import { ChevronLeftIcon, ChevronRightIcon } from "../../_components/icons";
import PageHeader from "../../_components/PageHeader";
import { focusLabel } from "../../_components/TaskRow";
import Timeline from "../../_components/Timeline";
import { eventsOn, useAgenda, useTaken } from "../../_components/TakenContext";

// Agenda: je afspraken (alleen lezen via iCal) en timeblocks voor taken.

const at = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();
const toTime = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function AgendaPage() {
  const { tasks, today, updateTask, openTask, plan, notify } = useTaken();
  const [date, setDate] = useState(today);
  const [placing, setPlacing] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);

  const monday = addDays(date, -((weekday(date) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const { data, loading } = useAgenda(monday, days[6]);
  const all = data?.events || [];

  const dayEvents = eventsOn(all, date);
  const timed = dayEvents.filter((e) => !e.allDay);
  const allDay = dayEvents.filter((e) => e.allDay);
  const blocks = tasks.filter((t) => t.blockStart?.startsWith(date) && t.status !== "ooit");
  const busy = [
    ...timed.filter((e) => e.busy).map((e) => [e.start, e.end] as [number, number]),
    ...blocks.filter((t) => t.status !== "af").map((t) => blockInterval(t) as [number, number]),
  ];
  const isWorkday = weekday(date) >= 1 && weekday(date) <= 5;
  const free = freeMinutes(busy, at(date, WORKDAY.start), at(date, WORKDAY.end), date === today ? Date.now() : 0);

  // Kandidaten om in te plannen: top 3 van vandaag eerst, dan de rest op volgorde van belang.
  const candidates = useMemo(() => {
    const top = date === today ? (plan?.top3 || []).map((p) => p.id) : [];
    const ranked = rankTasks(tasks, date, []).map((s) => s.task);
    const open = tasks.filter((t) => OPEN_STATUSES.includes(t.status));
    const ordered = [
      ...top.map((id) => open.find((t) => t.id === id)).filter(Boolean),
      ...ranked.filter((t) => !top.includes(t.id)),
    ] as Task[];
    return ordered.filter((t) => !t.blockStart?.startsWith(date)).slice(0, 12);
  }, [tasks, plan, date, today]);

  const placingTask = placing ? tasks.find((t) => t.id === placing) : null;

  const place = (taskId: string, time: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    updateTask(taskId, {
      blockStart: `${date}T${time}`,
      planDate: date,
      status: task.status === "inbox" || task.status === "af" ? "gepland" : task.status,
      estimate: task.estimate || 30,
    });
    setPlacing(null);
    setPicker(false);
    notify(`${task.title} om ${time}`);
  };

  const placeFirstFree = (task: Task) => {
    const duration = (task.estimate || 30) * 60000;
    const from = Math.max(at(date, WORKDAY.start), date === today ? Date.now() : 0);
    const slot = firstFreeSlot(busy, from, at(date, "22:00"), duration);
    if (slot === null) notify("Geen vrije plek meer op deze dag");
    else place(task.id, toTime(slot));
  };

  const eventDays = new Set(all.flatMap((e) => days.filter((d) => eventsOn([e], d).length)));
  const blockDays = new Set(tasks.filter((t) => t.blockStart).map((t) => t.blockStart!.slice(0, 10)));
  const [y, m] = monday.split("-").map(Number);

  const taskList = (
    <div className="tk-list">
      {candidates.length === 0 && <div className="tk-empty">Geen open taken om in te plannen.</div>}
      {candidates.map((t) => (
        <div
          key={t.id}
          className="tk-row"
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
          style={{ cursor: "grab", padding: "9px 0" }}
        >
          <div className="min-w-0 flex-1" onClick={() => setPlacing(placing === t.id ? null : t.id)} style={{ cursor: "pointer" }}>
            <div className="tk-row-title" style={{ fontWeight: placing === t.id ? 600 : undefined }}>
              {t.title}
            </div>
            <div className="tk-meta">
              <span>{estimateLabel(t.estimate || 30)}</span>
              {t.blockStart && <span>staat op {t.blockStart.slice(11, 16)} {t.blockStart.slice(0, 10) !== date ? "op een andere dag" : ""}</span>}
            </div>
          </div>
          <button type="button" className="tk-btn tk-btn-quiet tk-btn-sm" onClick={() => placeFirstFree(t)}>
            Eerste vrije plek
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow={`${MONTHS[m - 1]} ${y}`} title="Agenda">
        <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => setDate(today)}>
          Vandaag
        </button>
        <button type="button" className="tk-icon-btn" onClick={() => setDate(addDays(date, -7))} aria-label="Vorige week">
          <ChevronLeftIcon />
        </button>
        <button type="button" className="tk-icon-btn" onClick={() => setDate(addDays(date, 7))} aria-label="Volgende week">
          <ChevronRightIcon />
        </button>
      </PageHeader>

      <div className="tk-week">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === date}
            className={d === today ? "is-today" : ""}
            onClick={() => setDate(d)}
          >
            <span className="tk-wd">{WEEKDAYS_SHORT[weekday(d)]}</span>
            <span className="tk-dn">{Number(d.slice(8))}</span>
            <span className="tk-dots">
              {eventDays.has(d) && <span />}
              {blockDays.has(d) && <span style={{ background: "var(--text)" }} />}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }} className="first-letter:uppercase">
          {formatLong(date)}
        </h2>
        <span className="tk-muted text-sm">
          {loading && !data ? "Agenda laden…" : isWorkday ? (free > 0 ? `${focusLabel(free)} vrij tussen ${WORKDAY.start} en ${WORKDAY.end}` : "Werkdag zit vol") : "Weekend"}
        </span>
      </div>

      {data && !data.configured && (
        <p className="tk-faint mt-2 text-sm">
          Nog geen agenda gekoppeld. Zet je geheime iCal-link in <code>AGENDA_ICS_URLS</code> (zie README). Timeblocks voor taken werken al.
        </p>
      )}
      {data?.errors?.length ? (
        <p className="mt-2 text-sm" style={{ color: "var(--warn)" }}>
          Niet bereikbaar: {data.errors.join(", ")}
        </p>
      ) : null}

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
        <div>
          <div className="tk-mobile-only mb-3">
            {placingTask ? null : (
              <button type="button" className="tk-btn tk-btn-ghost w-full" onClick={() => setPicker((v) => !v)}>
                {picker ? "Sluiten" : "Taak inplannen"}
              </button>
            )}
            {picker && !placingTask && <div className="mt-2">{taskList}</div>}
          </div>

          {placingTask && (
            <div className="tk-banner mb-3" style={{ position: "sticky", top: 8, zIndex: 10 }}>
              <span className="min-w-0 flex-1">
                Tik op een tijd voor <strong>{placingTask.title}</strong> ({estimateLabel(placingTask.estimate || 30)})
              </span>
              <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => placeFirstFree(placingTask)}>
                Eerste vrije plek
              </button>
              <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => setPlacing(null)}>
                Annuleer
              </button>
            </div>
          )}

          {allDay.length > 0 && (
            <div className="tk-allday">
              {allDay.map((e) => (
                <div key={e.id}>{e.title}</div>
              ))}
            </div>
          )}

          <Timeline
            date={date}
            events={timed}
            blocks={blocks}
            placing={Boolean(placing)}
            onPlace={(time, id) => place(id || (placing as string), time)}
            onOpenTask={openTask}
          />
        </div>

        <aside className="tk-desktop-only">
          <div style={{ position: "sticky", top: 24 }}>
            <h3 className="tk-h2">Inplannen</h3>
            <p className="tk-faint mt-1 text-xs">Sleep een taak naar de tijdlijn, of klik erop en daarna op een tijd.</p>
            <div className="mt-2">{taskList}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
