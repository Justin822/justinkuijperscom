"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/lib/taken/types";
import { durationLabel } from "./time";

// Taken vanuit een lijst de agenda in slepen, met muis én touch (HTML5 drag-and-drop werkt niet op touch).
// Muis: slepen begint na 4 px. Touch: lang drukken (350 ms) en dan schuiven.

export type ExternalDrag = { task: Task; x: number; y: number };
type DropFn = (x: number, y: number, task: Task) => boolean;

const DragContext = createContext<{
  drag: ExternalDrag | null;
  begin: (task: Task, x: number, y: number) => void;
  register: (fn: DropFn) => () => void;
} | null>(null);

export function DragProvider({ children }: { children: React.ReactNode }) {
  const [drag, setDrag] = useState<ExternalDrag | null>(null);
  const dragRef = useRef<ExternalDrag | null>(null);
  dragRef.current = drag;
  const drops = useRef(new Set<DropFn>());
  const active = Boolean(drag);

  useEffect(() => {
    if (!active) return;
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      setDrag(null);
      if (!d) return;
      for (const fn of Array.from(drops.current)) if (fn(e.clientX, e.clientY, d.task)) break;
    };
    const cancel = () => setDrag(null);
    const key = (e: KeyboardEvent) => e.key === "Escape" && cancel();
    // Tijdens slepen op touch niet scrollen.
    const touch = (e: TouchEvent) => e.preventDefault();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    window.addEventListener("touchmove", touch, { passive: false });
    document.documentElement.classList.add("tk-dragging");
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("touchmove", touch);
      document.documentElement.classList.remove("tk-dragging");
    };
  }, [active]);

  const begin = useCallback((task: Task, x: number, y: number) => setDrag({ task, x, y }), []);
  const register = useCallback((fn: DropFn) => {
    drops.current.add(fn);
    return () => {
      drops.current.delete(fn);
    };
  }, []);
  const value = useMemo(() => ({ drag, begin, register }), [drag, begin, register]);

  return (
    <DragContext.Provider value={value}>
      {children}
      {drag && (
        <div className="tk-drag-ghost" style={{ left: drag.x + 14, top: drag.y + 10 }}>
          {drag.task.title} · {durationLabel(drag.task.estimate || 30)}
        </div>
      )}
    </DragContext.Provider>
  );
}

export function useExternalDrag() {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error("useExternalDrag buiten DragProvider");
  return ctx;
}

/** Maakt een lijstregel versleepbaar naar de agenda. Een gewone klik blijft gewoon werken. */
export function useDragSource() {
  const { begin } = useExternalDrag();
  return useCallback(
    (task: Task) => (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, input, a, textarea, select")) return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      let started = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
      };
      const start = (x: number, y: number) => {
        if (started) return;
        started = true;
        cleanup();
        // De klik die direct op het loslaten volgt niet laten doorgaan (alleen die ene).
        const swallow = (ev: MouseEvent) => ev.stopPropagation();
        window.addEventListener("click", swallow, { capture: true, once: true });
        window.addEventListener("pointerup", () => setTimeout(() => window.removeEventListener("click", swallow, true), 300), { once: true });
        begin(task, x, y);
      };
      const move = (ev: PointerEvent) => {
        const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
        if (e.pointerType === "mouse") {
          if (dist > 4) start(ev.clientX, ev.clientY);
        } else if (dist > 10) cleanup(); // scrollen, geen slepen
      };
      if (e.pointerType !== "mouse") {
        timer = setTimeout(() => {
          navigator.vibrate?.(10);
          start(x0, y0);
        }, 350);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    },
    [begin]
  );
}
