"use client";

import { useEffect, useRef } from "react";
import { blockInterval } from "@/lib/taken/agenda";
import type { CalendarEvent, Task } from "@/lib/taken/types";

// Dagtijdlijn: afspraken uit je agenda en timeblocks van taken naast elkaar.

const HOUR = 56; // pixels per uur

type Item = { id: string; start: number; end: number; title: string; sub?: string | null; task?: Task; free?: boolean };

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });

/** Overlappende items naast elkaar in kolommen. */
function layout(items: Item[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: { item: Item; col: number; cols: number }[] = [];
  let cluster: typeof placed = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    cluster.forEach((p) => (p.cols = cols));
    cluster = [];
  };
  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    const used = cluster.filter((p) => p.item.end > item.start).map((p) => p.col);
    let col = 0;
    while (used.includes(col)) col++;
    const entry = { item, col, cols: 1 };
    cluster.push(entry);
    placed.push(entry);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return placed;
}

export default function Timeline({
  date,
  events,
  blocks,
  placing,
  onPlace,
  onOpenTask,
}: {
  date: string;
  events: CalendarEvent[];
  blocks: Task[];
  placing: boolean;
  onPlace: (time: string, taskId?: string) => void;
  onOpenTask: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dayStart = new Date(`${date}T00:00:00`).getTime();
  const items: Item[] = [
    ...events.map((e) => ({ id: e.id, start: e.start, end: e.end, title: e.title, sub: e.location, free: !e.busy })),
    ...blocks.map((t) => {
      const [start, end] = blockInterval(t) as [number, number];
      return { id: t.id, start, end, title: t.title, task: t };
    }),
  ];
  const hourOf = (ms: number) => (ms - dayStart) / 3600000;
  const firstHour = Math.max(0, Math.min(7, ...items.map((i) => Math.floor(hourOf(i.start)))));
  const lastHour = Math.min(24, Math.max(22, ...items.map((i) => Math.ceil(hourOf(i.end)))));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);

  const now = Date.now();
  const isToday = now >= dayStart && now < dayStart + 24 * 3600000;

  // Eerste keer: naar het begin van de werkdag (of nu) scrollen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = isToday ? Math.max(hourOf(now) - 1, firstHour) : 8;
    const y = el.getBoundingClientRect().top + (target - firstHour) * HOUR;
    // Alleen scrollen als dat moment niet al in beeld is.
    if (y > window.innerHeight * 0.75) {
      window.scrollTo({ top: window.scrollY + y - window.innerHeight * 0.3, behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const timeAt = (clientY: number) => {
    const rect = (ref.current as HTMLDivElement).getBoundingClientRect();
    const minutes = Math.round((((clientY - rect.top) / HOUR) * 60) / 15) * 15 + firstHour * 60;
    const clamped = Math.max(firstHour * 60, Math.min(lastHour * 60 - 15, minutes));
    return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
  };

  return (
    <div
      ref={ref}
      className={`tk-timeline ${placing ? "is-placing" : ""}`}
      onClick={(e) => placing && onPlace(timeAt(e.clientY))}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (id) onPlace(timeAt(e.clientY), id);
      }}
    >
      {hours.map((h) => (
        <div key={h} className="tk-hour" style={{ height: HOUR }}>
          <span className="tk-hour-label">{String(h).padStart(2, "0")}:00</span>
        </div>
      ))}
      {isToday && <div className="tk-now" style={{ top: (hourOf(now) - firstHour) * HOUR }} />}
      {layout(items).map(({ item, col, cols }) => {
        const top = (hourOf(item.start) - firstHour) * HOUR;
        const height = Math.max(20, ((item.end - item.start) / 3600000) * HOUR - 2);
        const block = Boolean(item.task);
        return (
          <div
            key={item.id}
            className={`tk-ev ${block ? "is-block" : ""} ${item.task?.status === "af" ? "is-done" : ""} ${item.free ? "is-free" : ""}`}
            style={{
              top: top + 1,
              height,
              left: `calc(${(col / cols) * 100}% + 4px)`,
              width: `calc(${100 / cols}% - 6px)`,
            }}
            draggable={block}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
            onClick={(e) => {
              if (!block) return;
              e.stopPropagation();
              onOpenTask(item.id);
            }}
            title={`${hhmm(item.start)}–${hhmm(item.end)} ${item.title}`}
          >
            <div className="truncate" style={{ fontWeight: 550 }}>
              {item.title}
            </div>
            {height > 34 && (
              <div className="tk-ev-time truncate">
                {hhmm(item.start)}–{hhmm(item.end)}
                {item.sub ? ` · ${item.sub}` : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
