"use client";

import { useMemo, useState } from "react";
import { parseTask } from "@/lib/taken/parse";
import type { Task } from "@/lib/taken/types";
import Popover, { type Anchor } from "../Popover";
import { useTaken } from "../TakenContext";
import { blockStartOf, durationLabel, fmt } from "./time";

/** Nieuw blok in de agenda: titel typen, Enter, klaar. */
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
  const { addTasks, notify, today } = useTaken();
  const [text, setText] = useState("");
  const parsed = useMemo(() => (text.trim() ? parseTask(text, today) : null), [text, today]);

  const save = async () => {
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

  return (
    <Popover anchor={anchor} onClose={onClose} width={300} label="Nieuw blok">
      <form
        className="tk-pop-body"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="tk-muted text-xs">
          {fmt(start)}–{fmt(end)} · {durationLabel(end - start)}
        </div>
        <input
          className="tk-input-bare mt-1"
          style={{ fontSize: 16, fontWeight: 600 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Wat ga je doen?"
          autoFocus
          aria-label="Titel van het nieuwe blok"
          enterKeyHint="done"
        />
        {parsed && parsed.chips.filter((c) => c.kind === "gebied" || c.kind === "impact").length > 0 && (
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
        <div className="mt-3 flex gap-1.5">
          <button type="submit" className="tk-btn tk-btn-sm" disabled={!parsed?.title}>
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
