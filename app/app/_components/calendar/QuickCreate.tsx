"use client";

import { useEffect, useMemo, useState } from "react";
import { parseTask } from "@/lib/taken/parse";
import type { Task } from "@/lib/taken/types";
import Popover, { type Anchor } from "../Popover";
import { useTaken } from "../TakenContext";
import { blockStartOf, durationLabel, fmt, localMs } from "./time";
import { useEvents } from "./useEvents";

type Kind = "taak" | "afspraak";
const KIND_KEY = "tk-create-kind";

/** Nieuw blok in de agenda: titel typen, Enter, klaar. Met Tab wissel je tussen taak en Google-afspraak. */
export default function QuickCreate({
  day,
  start,
  end,
  anchor,
  onClose,
}: {
  day: string;
  start: number;
  end: number;
  anchor: Anchor;
  onClose: () => void;
}) {
  const { addTasks, notify, today, settings } = useTaken();
  const { create } = useEvents();
  const google = settings?.google;
  const canEvent = Boolean(google?.connected && google.canEdit && !google.needsReconnect);
  const calendars = (google?.calendars || []).filter((c) => c.writable !== false);
  const [kind, setKind] = useState<Kind>("taak");
  const [calendarId, setCalendarId] = useState<string | null>(google?.defaultCalendarId || calendars[0]?.id || null);
  const [text, setText] = useState("");
  const parsed = useMemo(() => (kind === "taak" && text.trim() ? parseTask(text, today) : null), [kind, text, today]);

  // De vorige keuze (taak of afspraak) onthouden.
  useEffect(() => {
    try {
      if (canEvent && localStorage.getItem(KIND_KEY) === "afspraak") setKind("afspraak");
    } catch {
      // geen opslag beschikbaar
    }
  }, [canEvent]);
  const choose = (k: Kind) => {
    setKind(k);
    try {
      localStorage.setItem(KIND_KEY, k);
    } catch {
      // geen opslag beschikbaar
    }
  };

  const save = async () => {
    if (kind === "afspraak") {
      const title = text.trim();
      if (!title) return;
      const calendar = calendars.find((c) => c.id === calendarId);
      onClose();
      await create({ title, start: localMs(day, start), end: localMs(day, end), calendarId, calendar: calendar?.name, color: calendar?.color });
      return;
    }
    if (!parsed?.title) return;
    const { chips, ...fields } = parsed;
    const input: Partial<Task> = {
      ...fields,
      blockStart: blockStartOf(day, start),
      estimate: end - start,
      planDate: day,
      status: "gepland",
    };
    onClose();
    try {
      await addTasks([input]);
      notify(`${parsed.title} om ${fmt(start)}`);
    } catch (err: any) {
      notify(err.message);
    }
  };

  const ready = kind === "afspraak" ? Boolean(text.trim()) : Boolean(parsed?.title);

  return (
    <Popover anchor={anchor} onClose={onClose} width={300} label="Nieuw blok">
      <form
        className="tk-pop-body"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="tk-muted text-xs">
            {fmt(start)}–{fmt(end)} · {durationLabel(end - start)}
          </div>
          {canEvent && (
            <div className="tk-seg tk-seg-xs" role="group" aria-label="Soort" title="Wisselen met Tab">
              <button type="button" aria-pressed={kind === "taak"} onClick={() => choose("taak")}>
                Taak
              </button>
              <button type="button" aria-pressed={kind === "afspraak"} onClick={() => choose("afspraak")}>
                Afspraak
              </button>
            </div>
          )}
        </div>
        <input
          className="tk-input-bare mt-1"
          style={{ fontSize: 16, fontWeight: 600 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Tab wisselt tussen taak en afspraak.
            if (e.key === "Tab" && canEvent && !e.shiftKey) {
              e.preventDefault();
              choose(kind === "taak" ? "afspraak" : "taak");
            }
          }}
          placeholder={kind === "afspraak" ? "Naam van de afspraak" : "Wat ga je doen?"}
          autoFocus
          aria-label={kind === "afspraak" ? "Titel van de nieuwe afspraak" : "Titel van het nieuwe blok"}
          enterKeyHint="done"
        />
        {kind === "taak" && parsed && parsed.chips.filter((c) => c.kind === "gebied" || c.kind === "impact").length > 0 && (
          <div className="tk-tags">
            {parsed.chips
              .filter((c) => c.kind === "gebied" || c.kind === "impact")
              .map((c, i) => (
                <span key={i} className="tk-tag">
                  {c.label}
                </span>
              ))}
          </div>
        )}
        {kind === "afspraak" && calendars.length > 1 && (
          <label className="tk-muted mt-2 flex items-center gap-2 text-xs">
            <span className="tk-dot" style={{ background: calendars.find((c) => c.id === calendarId)?.color || "var(--faint)" }} />
            <select
              className="tk-select-bare"
              value={calendarId || ""}
              onChange={(e) => setCalendarId(e.target.value)}
              aria-label="Agenda"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-3 flex items-center gap-1.5">
          <button type="submit" className="tk-btn tk-btn-sm" disabled={!ready}>
            Toevoegen
          </button>
          <button type="button" className="tk-btn tk-btn-quiet tk-btn-sm" onClick={onClose}>
            Annuleren
          </button>
        </div>
      </form>
    </Popover>
  );
}
