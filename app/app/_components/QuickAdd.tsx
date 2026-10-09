"use client";

import { useMemo, useState } from "react";
import { parseTask, splitEntries } from "@/lib/taken/parse";
import type { Source, Task } from "@/lib/taken/types";
import { MicIcon, PlusIcon } from "./icons";
import { useTaken } from "./TakenContext";
import { useSpeech } from "./useSpeech";

// Eén zin typen of inspreken; de herkende stukjes verschijnen meteen als chips.

export default function QuickAdd() {
  const { addRef, addTasks, today, notify } = useTaken();
  const [text, setText] = useState("");
  const [source, setSource] = useState<Source>("handmatig");
  const [busy, setBusy] = useState(false);

  const entries = useMemo(
    () => splitEntries(text).map((entry) => parseTask(entry, today)).filter((p) => p.title),
    [text, today]
  );

  const save = async () => {
    if (!entries.length || busy) return;
    setBusy(true);
    try {
      const inputs: Partial<Task>[] = entries.map(({ chips, ...fields }) => ({ ...fields, source }));
      const created = await addTasks(inputs);
      setText("");
      setSource("handmatig");
      const where = created.every((t) => t.status === "inbox") ? "in je Inbox" : "opgeslagen";
      notify(created.length === 1 ? `Taak staat ${where}` : `${created.length} taken staan ${where}`);
    } catch (err: any) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  const speech = useSpeech((spoken, final) => {
    setText(spoken);
    setSource("spraak");
    if (final) addRef.current?.focus();
  });

  return (
    <div className="tk-add">
      <form
        className="tk-add-box"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          ref={addRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setText("");
              e.currentTarget.blur();
            }
          }}
          placeholder="Nieuwe taak… bijv. Offerte Jansen vrijdag, Appèl, half uur"
          aria-label="Nieuwe taak"
          enterKeyHint="done"
          autoComplete="off"
        />
        {speech.supported && (
          <button
            type="button"
            className={`tk-icon-btn tk-mic ${speech.listening ? "is-on" : ""}`}
            onClick={speech.listening ? speech.stop : speech.start}
            aria-label={speech.listening ? "Stop met inspreken" : "Inspreken"}
            title="Inspreken"
          >
            <MicIcon />
          </button>
        )}
        <button type="submit" className="tk-btn" disabled={!entries.length || busy} aria-label="Toevoegen">
          <PlusIcon className="h-4 w-4" />
        </button>
      </form>
      {entries.length > 0 && (
        <div className="tk-card tk-add-preview">
          {entries.map((p, i) => (
            <div key={i} className={i ? "mt-2 border-t pt-2" : ""} style={{ borderColor: "var(--line)" }}>
              <div style={{ fontWeight: 600 }}>{p.title}</div>
              <div className="tk-row-meta">
                {p.chips.length ? (
                  p.chips.map((c, j) => (
                    <span key={j} className="tk-chip tk-chip-accent">
                      {c.label}
                    </span>
                  ))
                ) : (
                  <span className="tk-faint" style={{ fontSize: 13 }}>
                    Gaat naar de Inbox. Tip: noem een dag, gebied of tijd.
                  </span>
                )}
              </div>
            </div>
          ))}
          {speech.listening && <div className="tk-faint mt-2 text-xs">Aan het luisteren… zeg &quot;en daarnaast&quot; voor nog een taak.</div>}
        </div>
      )}
    </div>
  );
}
