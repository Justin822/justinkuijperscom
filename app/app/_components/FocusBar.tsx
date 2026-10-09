"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, PauseIcon, PlayIcon, StopIcon, XIcon } from "./icons";
import { focusElapsed, useTaken } from "./TakenContext";

// Focus-timer: smalle balk onderin, en een rustig volledig scherm als je erop tikt.

const clock = (ms: number) => {
  const total = Math.round(Math.abs(ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${ms < 0 ? "+" : ""}${m}:${String(s).padStart(2, "0")}`;
};

function chime() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.25;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  } catch {
    // geen geluid beschikbaar
  }
}

export default function FocusBar() {
  const { focus, tasks, pauseFocus, resumeFocus, stopFocus, focusOpen, setFocusOpen } = useTaken();
  const [, setTick] = useState(0);
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (!focus?.runningSince) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [focus?.runningSince]);

  useEffect(() => {
    if (!focusOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFocusOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusOpen, setFocusOpen]);

  const task = focus ? tasks.find((t) => t.id === focus.taskId) : null;
  const remaining = focus ? focus.minutes * 60000 - focusElapsed(focus) : 0;

  // Tijd om: één keer een seintje.
  useEffect(() => {
    if (!focus || remaining > 0) return;
    const key = `${focus.taskId}:${focus.minutes}`;
    if (notified.current === key) return;
    notified.current = key;
    chime();
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Focusblok klaar", { body: task?.title || "", silent: true });
      }
    } catch {
      // meldingen niet beschikbaar
    }
  }, [focus, remaining, task?.title]);

  if (!focus) return null;
  const running = Boolean(focus.runningSince);
  const over = remaining <= 0;

  if (focusOpen) {
    return (
      <div className="tk-focus-screen" role="dialog" aria-label="Focus">
        <button
          type="button"
          className="tk-icon-btn"
          style={{ position: "absolute", top: "calc(16px + env(safe-area-inset-top))", right: 16 }}
          onClick={() => setFocusOpen(false)}
          aria-label="Verkleinen"
        >
          <XIcon />
        </button>
        <div className="tk-eyebrow">{over ? "Tijd om" : running ? "Focus" : "Gepauzeerd"}</div>
        <div style={{ fontSize: 20, fontWeight: 550, letterSpacing: "-0.02em", maxWidth: 520 }}>
          {task?.title || "Taak"}
        </div>
        <div className="tk-focus-time" style={{ color: over ? "var(--muted)" : undefined }}>
          {clock(remaining)}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {running ? (
            <button type="button" className="tk-btn tk-btn-ghost" onClick={pauseFocus}>
              <PauseIcon className="h-4 w-4" /> Pauzeren
            </button>
          ) : (
            <button type="button" className="tk-btn tk-btn-ghost" onClick={resumeFocus}>
              <PlayIcon className="h-3.5 w-3.5" /> Doorgaan
            </button>
          )}
          <button type="button" className="tk-btn" onClick={() => stopFocus(true)}>
            <CheckIcon className="h-4 w-4" /> Taak af
          </button>
          <button type="button" className="tk-btn tk-btn-ghost" onClick={() => stopFocus(false)}>
            <StopIcon className="h-4 w-4" /> Stoppen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tk-focusbar" role="status">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => setFocusOpen(true)}
        aria-label="Focus openen"
      >
        <span className="tk-num" style={{ fontWeight: 600, fontSize: 15, opacity: over ? 0.6 : 1 }}>
          {clock(remaining)}
        </span>
        <span className="truncate text-sm" style={{ opacity: 0.8 }}>
          {task?.title || "Focus"}
        </span>
      </button>
      {running ? (
        <button type="button" className="tk-icon-btn" onClick={pauseFocus} aria-label="Pauzeren">
          <PauseIcon />
        </button>
      ) : (
        <button type="button" className="tk-icon-btn" onClick={resumeFocus} aria-label="Doorgaan">
          <PlayIcon />
        </button>
      )}
      <button type="button" className="tk-icon-btn" onClick={() => stopFocus(false)} aria-label="Stoppen">
        <StopIcon />
      </button>
    </div>
  );
}
