"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { freeMinutes, type Interval } from "@/lib/taken/agenda";
import { OPEN_STATUSES } from "@/lib/taken/config";
import { weekday, WEEKDAYS_SHORT } from "@/lib/taken/dates";
import type { CalendarEvent, Task } from "@/lib/taken/types";
import { CheckIcon } from "../icons";
import { anchorOf, type Anchor } from "../Popover";
import { useTaken } from "../TakenContext";
import { focusLabel } from "../TaskRow";
import BlockPopover, { GuestConfirm, type Block } from "./BlockPopover";
import { useExternalDrag } from "./DragLayer";
import { layoutDay } from "./layout";
import QuickCreate from "./QuickCreate";
import {
  applyDrag,
  blockStartOf,
  clamp,
  DAY_MINUTES,
  durationLabel,
  fmt,
  localMs,
  localParts,
  minutesToPx,
  pxToMinutes,
  toMinutes,
} from "./time";
import { movable, useEvents } from "./useEvents";

// De agenda: dag- of weekrooster met je afspraken en de timeblocks van taken.
// Slepen = verplaatsen, randen slepen = duur/begin aanpassen, op een lege plek slepen = nieuw blok.
// Touch: lang drukken om op te pakken; een geselecteerd blok heeft grepen om op te rekken.
// Google-afspraken die je zelf organiseert werken hetzelfde; met gasten vraagt de app of zij een mail krijgen.

type Mode = "move" | "resize-top" | "resize-bottom" | "create";
type DragState = { mode: Mode; id: string; day: string; start: number; end: number; orig: { day: string; start: number; end: number } };
type Confirm = {
  kind: "move" | "delete";
  event: CalendarEvent;
  change?: { start: number; end: number };
  message?: string;
  anchor: Anchor;
};
export type Ghost = { taskId: string; day: string; start: number; end: number };

const floorQuarter = (m: number) => Math.floor(m / 15) * 15;

export default function CalendarGrid({
  days,
  events,
  layoutKey = "",
  hourHeight = 48,
  placingTaskId = null,
  onPlaced,
  ghosts = [],
  showHeader = false,
  onDayClick,
}: {
  days: string[];
  events: CalendarEvent[];
  /** Verandert de inhoud boven het rooster, geef dan een andere sleutel zodat de hoogte opnieuw wordt berekend. */
  layoutKey?: string;
  hourHeight?: number;
  /** Taak die met een tik op een tijd wordt ingepland (mobiel). */
  placingTaskId?: string | null;
  onPlaced?: () => void;
  /** Voorstel-blokken (Plan mijn dag). */
  ghosts?: Ghost[];
  showHeader?: boolean;
  onDayClick?: (day: string) => void;
}) {
  const { tasks, today, workday, changeTask, updateTask } = useTaken();
  const eventActions = useEvents();
  const H = hourHeight;
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const setDrag = (d: DragState | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  const [selected, setSelected] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ block: Block; anchor: Anchor } | null>(null);
  const [creating, setCreating] = useState<{ day: string; start: number; end: number; anchor: Anchor } | null>(null);
  // Afspraak met gasten versleept: blijft op de nieuwe plek staan tot je kiest of de gasten een mail krijgen.
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [pending, setPending] = useState<{ id: string; day: string; start: number; end: number } | null>(null);
  const touchLock = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const ext = useExternalDrag();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Tijdens slepen op touch niet laten scrollen.
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (touchLock.current) e.preventDefault();
    };
    window.addEventListener("touchmove", block, { passive: false });
    return () => window.removeEventListener("touchmove", block);
  }, []);

  // ---------- Blokken per dag ----------
  const blocks = useMemo(() => {
    const list: Block[] = [];
    const inView = new Set(days);
    for (const t of tasks) {
      if (!t.blockStart || t.status === "ooit") continue;
      const day = t.blockStart.slice(0, 10);
      if (!inView.has(day)) continue;
      const start = toMinutes(t.blockStart.slice(11, 16));
      list.push({ id: t.id, kind: "task", day, start, end: Math.min(DAY_MINUTES, start + (t.estimate || 30)), task: t });
    }
    for (const e of events) {
      if (e.allDay) continue;
      const s = localParts(e.start);
      const en = localParts(e.end);
      // Een afspraak binnen één dag houdt zijn id, ook als je hem naar een andere dag sleept.
      const oneDay = s.date === localParts(e.end - 1).date;
      for (const day of days) {
        if (day < s.date || day > en.date) continue;
        const start = day === s.date ? s.minutes : 0;
        const end = day === en.date ? en.minutes : DAY_MINUTES;
        if (end > start) list.push({ id: oneDay ? e.id : `${e.id}|${day}`, kind: "event", day, start, end, event: e });
      }
    }
    return list;
  }, [tasks, events, days]);

  const lanes = useMemo(
    () =>
      days.map((day) => ({
        day,
        events: events.filter((e) => e.allDay && (e.startDate as string) <= day && day < (e.endDate as string)),
        tasks: tasks.filter((t) => t.planDate === day && !t.blockStart && OPEN_STATUSES.includes(t.status)),
      })),
    [days, events, tasks]
  );
  const hasLane = lanes.some((l) => l.events.length || l.tasks.length);

  // Tijdens slepen staat het blok op zijn nieuwe plek (ook in een andere dagkolom).
  const moved = drag || pending;
  const display = blocks.map((b) => (moved && b.id === moved.id ? { ...b, day: moved.day, start: moved.start, end: moved.end } : b));
  /** Kun je dit blok slepen en oprekken? */
  const canEdit = (b: Block | null | undefined) => Boolean(b && (b.kind === "task" || movable(b.event)));

  // ---------- Hulpjes ----------
  const slotAt = useCallback(
    (x: number, y: number) => {
      const r = (colsRef.current as HTMLDivElement).getBoundingClientRect();
      const idx = clamp(Math.floor(((x - r.left) / r.width) * days.length), 0, days.length - 1);
      return {
        day: days[idx],
        idx,
        minutes: clamp(pxToMinutes(y - r.top, H), 0, DAY_MINUTES),
        inside: x >= r.left && x <= r.right && y >= r.top && y <= r.bottom,
      };
    },
    [days, H]
  );

  const rangeAnchor = (day: string, start: number, end: number): Anchor => {
    const r = (colsRef.current as HTMLDivElement).getBoundingClientRect();
    const w = r.width / days.length;
    const left = r.left + days.indexOf(day) * w;
    return { left, right: left + w, top: r.top + minutesToPx(start, H), bottom: r.top + minutesToPx(end, H) };
  };

  const dayName = (day: string) => (days.length > 1 || day !== today ? `${WEEKDAYS_SHORT[weekday(day)]} ` : "");

  const place = useCallback(
    (taskId: string, day: string, startMin: number) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const dur = task.estimate || 30;
      const start = clamp(floorQuarter(startMin), 0, DAY_MINUTES - dur);
      changeTask(
        taskId,
        { blockStart: blockStartOf(day, start), planDate: day, estimate: dur, status: task.status === "inbox" || task.status === "af" ? "gepland" : task.status },
        `${task.title} om ${dayName(day)}${fmt(start)}`
      );
      onPlaced?.();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, changeTask, onPlaced, days, today]
  );

  // Taken die vanuit een lijst op het rooster worden losgelaten.
  const placeRef = useRef(place);
  placeRef.current = place;
  useEffect(
    () =>
      ext.register((x, y, task) => {
        if (!colsRef.current) return false;
        const slot = slotAt(x, y);
        if (!slot.inside) return false;
        placeRef.current(task.id, slot.day, slot.minutes);
        return true;
      }),
    [ext, slotAt]
  );

  /** Nieuwe tijd voor een Google-afspraak; met gasten eerst vragen of zij een mail krijgen. */
  const moveEvent = (blockId: string, e: CalendarEvent, day: string, start: number, end: number, message: string) => {
    const change = { start: localMs(day, start), end: localMs(day, end) };
    if (change.start === e.start && change.end === e.end) return;
    if (e.guests > 0) {
      setPending({ id: blockId, day, start, end });
      setConfirm({ kind: "move", event: e, change, message, anchor: rangeAnchor(day, start, end) });
      return;
    }
    eventActions.update(e, change, message);
  };

  const removeEvent = (e: CalendarEvent, anchor: Anchor) => {
    setPopover(null);
    setSelected(null);
    if (e.guests > 0) setConfirm({ kind: "delete", event: e, anchor });
    else eventActions.remove(e);
  };

  const commit = (d: DragState) => {
    if (d.mode === "create") {
      setCreating({ day: d.day, start: d.start, end: d.end, anchor: rangeAnchor(d.day, d.start, d.end) });
      return;
    }
    if (d.day === d.orig.day && d.start === d.orig.start && d.end === d.orig.end) return;
    const message =
      d.mode === "move"
        ? `Verplaatst naar ${dayName(d.day)}${fmt(d.start)}`
        : `${fmt(d.start)}–${fmt(d.end)} · ${durationLabel(d.end - d.start)}`;
    const block = blocks.find((b) => b.id === d.id);
    if (block?.kind === "event" && block.event) {
      moveEvent(block.id, block.event, d.day, d.start, d.end, message);
      return;
    }
    const task = tasks.find((t) => t.id === d.id);
    if (!task) return;
    const patch: Partial<Task> = { blockStart: blockStartOf(d.day, d.start), planDate: d.day };
    if (d.end - d.start !== d.orig.end - d.orig.start) patch.estimate = d.end - d.start;
    if (task.status === "inbox") patch.status = "gepland";
    changeTask(task.id, patch, message);
  };

  const toggleDone = (task: Task) => {
    if (task.status === "af") updateTask(task.id, { status: task.areaId ? "gepland" : "inbox" });
    else changeTask(task.id, { status: "af" }, task.repeat ? "Afgevinkt, de volgende staat klaar" : "Afgevinkt");
  };

  // ---------- Aanwijzer: klikken, slepen, oprekken, aanmaken ----------
  const startPress = (e: React.PointerEvent, mode: Mode, block: Block | null) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.stopPropagation();
    const touch = e.pointerType !== "mouse";
    const target = e.currentTarget as HTMLElement;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const slot0 = slotAt(x0, y0);
    const draggable = !block || canEdit(block);
    const orig = block
      ? { day: block.day, start: block.start, end: block.end }
      : { day: slot0.day, start: floorQuarter(slot0.minutes), end: floorQuarter(slot0.minutes) + 15 };
    const grabOffset = slot0.minutes - orig.start;
    // Op touch eerst lang drukken (behalve aan de grepen van een geselecteerd blok), zodat scrollen gewoon werkt.
    const needsLongPress = touch && (mode === "create" || (mode === "move" && selected !== block?.id));
    let active = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let scroller: ReturnType<typeof setInterval> | null = null;
    let last = { x: x0, y: y0, alt: false };

    const update = () => {
      const slot = slotAt(last.x, last.y);
      const r = applyDrag(mode, orig, slot.minutes, grabOffset, last.alt ? 5 : 15);
      setDrag({ mode, id: block?.id || "new", day: mode === "move" ? slot.day : orig.day, start: r.start, end: r.end, orig });
    };
    const activate = () => {
      if (active || !draggable) return;
      active = true;
      touchLock.current = true;
      if (touch) navigator.vibrate?.(10);
      setPopover(null);
      update();
      // Automatisch scrollen als je bij de rand van het rooster komt.
      scroller = setInterval(() => {
        const el = scrollRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const step = last.y < r.top + 40 ? -12 : last.y > r.bottom - 40 ? 12 : 0;
        if (step) {
          el.scrollTop += step;
          update();
        }
      }, 30);
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (scroller) clearInterval(scroller);
      touchLock.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
    };
    const click = () => {
      if (block) {
        setSelected(canEdit(block) ? block.id : null);
        setCreating(null);
        setPopover({ block, anchor: anchorOf(target) });
        return;
      }
      // Lege plek aangetikt.
      if (placingTaskId) {
        place(placingTaskId, orig.day, orig.start);
        return;
      }
      if (popover || selected || creating || confirm) {
        setPopover(null);
        setSelected(null);
        setCreating(null);
        return;
      }
      if (touch) {
        const end = Math.min(orig.start + 30, DAY_MINUTES);
        setCreating({ day: orig.day, start: orig.start, end, anchor: rangeAnchor(orig.day, orig.start, end) });
      }
    };
    const finish = (ok: boolean) => {
      cleanup();
      const d = dragRef.current;
      setDrag(null);
      if (!ok) return;
      if (active && d) commit(d);
      else if (!active) click();
    };
    const move = (ev: PointerEvent) => {
      last = { x: ev.clientX, y: ev.clientY, alt: ev.altKey };
      if (!active) {
        const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
        if (needsLongPress) {
          if (dist > 8) {
            // Dit is scrollen, geen slepen.
            cleanup();
          }
          return;
        }
        if (dist > 4) activate();
        else return;
      }
      update();
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        finish(false);
      }
    };
    if (needsLongPress && draggable) timer = setTimeout(activate, 300);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
  };

  // ---------- Toetsenbord: geselecteerd blok verschuiven of oprekken ----------
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey) return;
      const block = blocks.find((b) => b.id === selected);
      if (!block || !canEdit(block)) return;
      const task = block.kind === "task" ? block.task : undefined;
      const event = block.kind === "event" ? block.event : undefined;
      const { day, start } = block;
      const dur = block.end - block.start;
      const set = (d: string, s: number, len: number) => {
        const from = clamp(s, 0, DAY_MINUTES - len);
        if (task) updateTask(task.id, { blockStart: blockStartOf(d, from), estimate: len, planDate: d });
        else if (event) moveEvent(block.id, event, d, from, from + len, `${dayName(d)}${fmt(from)}–${fmt(from + len)}`);
      };
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const delta = e.key === "ArrowUp" ? -15 : 15;
        if (e.shiftKey) set(day, start, clamp(dur + delta, 15, DAY_MINUTES - start));
        else set(day, start + delta, dur);
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && days.length > 1) {
        e.preventDefault();
        const i = days.indexOf(day) + (e.key === "ArrowLeft" ? -1 : 1);
        if (days[i]) set(days[i], start, dur);
      } else if (e.key === " " && task) {
        e.preventDefault();
        toggleDone(task);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (task) {
          changeTask(task.id, { blockStart: null }, "Uit de agenda gehaald");
          setSelected(null);
          setPopover(null);
        } else if (event) {
          removeEvent(event, rangeAnchor(day, block.start, block.end));
        }
      } else if (e.key === "Escape") {
        setSelected(null);
        setPopover(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, blocks, days]);

  // ---------- Hoogte: het rooster vult de rest van het scherm ----------
  const [height, setHeight] = useState(480);
  useLayoutEffect(() => {
    const calc = () => {
      const el = scrollRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const bottom = window.matchMedia("(max-width: 899px)").matches ? 78 : 20;
      setHeight(Math.max(320, Math.round(window.innerHeight - top - bottom)));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [hasLane, showHeader, days.length, placingTaskId, layoutKey]);

  // ---------- Beginpositie: rond nu, of het begin van je werkdag ----------
  const showsToday = days.includes(today);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const focus = showsToday ? localParts(Date.now()).minutes - 90 : toMinutes(workday.start) - 30;
    el.scrollTop = minutesToPx(Math.max(0, focus), H);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0], days.length, H]);

  // Vrije werktijd per dag (voor de kop in de weekweergave).
  const freeByDay = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const day of days) {
      if (day < today) {
        out[day] = null;
        continue;
      }
      const busy: Interval[] = [
        ...events.filter((e) => e.busy && !e.allDay).map((e) => [e.start, e.end] as Interval),
        ...blocks
          .filter((b) => b.kind === "task" && b.day === day && b.task?.status !== "af")
          .map((b) => [localMs(day, b.start), localMs(day, b.end)] as Interval),
      ];
      out[day] = freeMinutes(
        busy,
        localMs(day, toMinutes(workday.start)),
        localMs(day, toMinutes(workday.end)),
        day === today ? Date.now() : 0
      );
    }
    return out;
  }, [days, events, blocks, today, workday]);

  // Voorbeeld van een taak die vanuit een lijst over het rooster wordt gesleept.
  let dropPreview: { day: string; start: number; end: number } | null = null;
  if (ext.drag && colsRef.current) {
    const slot = slotAt(ext.drag.x, ext.drag.y);
    if (slot.inside) {
      const dur = ext.drag.task.estimate || 30;
      const start = clamp(floorQuarter(slot.minutes), 0, DAY_MINUTES - dur);
      dropPreview = { day: slot.day, start, end: start + dur };
    }
  }

  const ws = toMinutes(workday.start);
  const we = toMinutes(workday.end);
  const nowParts = localParts(now);

  return (
    <div className={`cal ${placingTaskId ? "is-placing" : ""}`} style={{ ["--h" as any]: `${H}px` }}>
      {showHeader && (
        <div className="cal-head">
          <div className="cal-gutter" />
          {days.map((day) => (
            <button
              key={day}
              type="button"
              className={`cal-dayhead ${day === today ? "is-today" : ""}`}
              onClick={() => onDayClick?.(day)}
            >
              <span className="cal-wd">{WEEKDAYS_SHORT[weekday(day)]}</span>
              <span className="cal-dn">{Number(day.slice(8))}</span>
              {freeByDay[day] != null && weekday(day) >= 1 && weekday(day) <= 5 && (
                <span className="cal-free">{freeByDay[day] ? `${focusLabel(freeByDay[day] as number)} vrij` : "vol"}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {hasLane && (
        <div className="cal-lane-row">
          <div className="cal-gutter cal-gutter-text">hele dag</div>
          {lanes.map((lane) => (
            <div key={lane.day} className="cal-lane">
              {lane.events.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="cal-chip is-event"
                  style={e.color ? ({ ["--c" as any]: e.color } as React.CSSProperties) : undefined}
                  onClick={(ev) =>
                    setPopover({ block: { id: e.id, kind: "event", day: lane.day, start: 0, end: DAY_MINUTES, event: e }, anchor: anchorOf(ev.currentTarget) })
                  }
                >
                  {e.title}
                </button>
              ))}
              {lane.tasks.map((t) => (
                <LaneTask key={t.id} task={t} day={lane.day} onOpen={(anchor) => setPopover({ block: { id: t.id, kind: "task", day: lane.day, start: 0, end: 0, task: t }, anchor })} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="cal-scroll" ref={scrollRef} style={{ height }}>
        <div className="cal-body" style={{ height: minutesToPx(DAY_MINUTES, H) }}>
          <div className="cal-gutter">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span key={h} className="cal-hour" style={{ top: h * H }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          <div className="cal-cols" ref={colsRef}>
            {days.map((day) => {
              const dayBlocks = display.filter((b) => b.day === day);
              const placed = layoutDay(
                dayBlocks.filter((b) => !(drag && b.id === drag.id)).map((b) => ({ id: b.id, start: b.start, end: b.end }))
              );
              const preview =
                (drag?.mode === "create" && drag.day === day && drag) ||
                (creating && creating.day === day && creating) ||
                (dropPreview && dropPreview.day === day && dropPreview);
              return (
                <div
                  key={day}
                  className={`cal-col ${day === today ? "is-today" : ""}`}
                  data-day={day}
                  onPointerDown={(e) => startPress(e, "create", null)}
                  onDoubleClick={(e) => {
                    const slot = slotAt(e.clientX, e.clientY);
                    const start = floorQuarter(slot.minutes);
                    const end = Math.min(start + 30, DAY_MINUTES);
                    setCreating({ day, start, end, anchor: rangeAnchor(day, start, end) });
                  }}
                >
                  <div className="cal-off" style={{ top: 0, height: minutesToPx(ws, H) }} />
                  <div className="cal-off" style={{ top: minutesToPx(we, H), bottom: 0 }} />
                  {day === nowParts.date && <div className="cal-now" style={{ top: minutesToPx(nowParts.minutes, H) }} />}

                  {dayBlocks.map((b) => {
                    const dragging = Boolean(drag && b.id === drag.id);
                    const p = dragging ? { left: 0, width: 1 } : placed.get(b.id) || { left: 0, width: 1 };
                    const top = minutesToPx(b.start, H);
                    const h = Math.max(minutesToPx(b.end - b.start, H) - 2, 18);
                    const compact = b.end - b.start < 45;
                    const style: React.CSSProperties = {
                      top: top + 1,
                      height: h,
                      left: `calc(${p.left * 100}% + 2px)`,
                      width: `calc(${p.width * 100}% - 4px)`,
                    };
                    if (b.kind === "event") {
                      const e = b.event as CalendarEvent;
                      const editable = canEdit(b);
                      const isMoved = Boolean(moved && b.id === moved.id);
                      return (
                        <div
                          key={b.id}
                          className={`cal-block is-event ${e.busy ? "" : "is-free"} ${compact ? "is-compact" : ""} ${
                            editable ? "is-editable" : ""
                          } ${selected === b.id ? "is-selected" : ""} ${dragging ? "is-dragging" : ""} ${
                            e.eventId ? "" : "is-saving"
                          }`}
                          style={{ ...style, ...(e.color ? { ["--c" as any]: e.color } : {}) }}
                          onPointerDown={(ev) => startPress(ev, "move", b)}
                          title={`${fmt(b.start)}–${fmt(b.end)} ${e.title}`}
                          data-event={e.id}
                        >
                          <div className="cal-text">
                            <span className="cal-title">{e.title}</span>
                            <span className="cal-time">
                              {fmt(b.start)}
                              {compact ? "" : `–${fmt(b.end)}`}
                            </span>
                          </div>
                          {isMoved && <span className="cal-drag-label">{`${fmt(b.start)}–${fmt(b.end)}`}</span>}
                          {editable && (
                            <>
                              <div className="cal-handle is-top" onPointerDown={(ev) => startPress(ev, "resize-top", b)} />
                              <div className="cal-handle is-bottom" onPointerDown={(ev) => startPress(ev, "resize-bottom", b)} />
                            </>
                          )}
                        </div>
                      );
                    }
                    const t = b.task as Task;
                    const done = t.status === "af";
                    return (
                      <div
                        key={b.id}
                        className={`cal-block is-task ${done ? "is-done" : ""} ${compact ? "is-compact" : ""} ${
                          selected === b.id ? "is-selected" : ""
                        } ${dragging ? "is-dragging" : ""}`}
                        style={style}
                        onPointerDown={(ev) => startPress(ev, "move", b)}
                        data-task={t.id}
                      >
                        <button
                          type="button"
                          className="cal-check"
                          aria-label={done ? "Weer openzetten" : "Afvinken"}
                          onPointerDown={(ev) => ev.stopPropagation()}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            toggleDone(t);
                          }}
                        >
                          <CheckIcon />
                        </button>
                        <div className="cal-text">
                          <span className="cal-title">{t.title}</span>
                          <span className="cal-time">
                            {fmt(b.start)}–{fmt(b.end)}
                          </span>
                        </div>
                        {dragging && <span className="cal-drag-label">{`${fmt(b.start)}–${fmt(b.end)}`}</span>}
                        <div className="cal-handle is-top" onPointerDown={(ev) => startPress(ev, "resize-top", b)} />
                        <div className="cal-handle is-bottom" onPointerDown={(ev) => startPress(ev, "resize-bottom", b)} />
                      </div>
                    );
                  })}

                  {ghosts
                    .filter((g) => g.day === day)
                    .map((g) => {
                      const task = tasks.find((t) => t.id === g.taskId);
                      return (
                        <div
                          key={`ghost-${g.taskId}`}
                          className="cal-block is-ghost"
                          style={{ top: minutesToPx(g.start, H) + 1, height: Math.max(minutesToPx(g.end - g.start, H) - 2, 18), left: 2, right: 2 }}
                        >
                          <div className="cal-text">
                            <span className="cal-title">{task?.title}</span>
                            <span className="cal-time">
                              {fmt(g.start)}–{fmt(g.end)}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                  {preview && (
                    <div
                      className="cal-block is-ghost is-new"
                      style={{ top: minutesToPx(preview.start, H) + 1, height: Math.max(minutesToPx(preview.end - preview.start, H) - 2, 18), left: 2, right: 2 }}
                    >
                      <div className="cal-text">
                        <span className="cal-title">{dropPreview && dropPreview.day === day ? ext.drag?.task.title : "Nieuw"}</span>
                        <span className="cal-time">
                          {fmt(preview.start)}–{fmt(preview.end)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {popover && (
        <BlockPopover
          block={popover.block}
          anchor={popover.anchor}
          onClose={() => {
            setPopover(null);
          }}
          onEventTime={(e, start, end, message) => {
            const b = blocks.find((x) => x.kind === "event" && x.event?.id === e.id);
            const s0 = localParts(start);
            if (b) moveEvent(b.id, e, s0.date, s0.minutes, s0.minutes + Math.round((end - start) / 60000), message);
          }}
          onEventDelete={(e) => removeEvent(e, popover.anchor)}
        />
      )}
      {confirm && (
        <GuestConfirm
          anchor={confirm.anchor}
          kind={confirm.kind}
          event={confirm.event}
          onChoose={(mail) => {
            if (confirm.kind === "move" && confirm.change) eventActions.update(confirm.event, confirm.change, confirm.message || "Verplaatst", mail);
            if (confirm.kind === "delete") eventActions.remove(confirm.event, mail);
            setPending(null);
            setConfirm(null);
          }}
          onCancel={() => {
            setPending(null);
            setConfirm(null);
          }}
        />
      )}
      {creating && (
        <QuickCreate
          day={creating.day}
          start={creating.start}
          end={creating.end}
          anchor={creating.anchor}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  );
}

/** Taak zonder tijd in de hele-dag-baan: versleepbaar naar het rooster. */
function LaneTask({ task, day, onOpen }: { task: Task; day: string; onOpen: (anchor: Anchor) => void }) {
  const { begin } = useExternalDrag();
  return (
    <button
      type="button"
      className="cal-chip is-task"
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") return;
        const x0 = e.clientX;
        const y0 = e.clientY;
        const move = (ev: PointerEvent) => {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 4) {
            stop();
            begin(task, ev.clientX, ev.clientY);
          }
        };
        const stop = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", stop);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", stop);
      }}
      onClick={(e) => onOpen(anchorOf(e.currentTarget))}
      title={`${task.title} (${day}) – sleep naar een tijd`}
    >
      ○ {task.title}
    </button>
  );
}
