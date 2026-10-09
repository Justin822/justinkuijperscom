"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AREAS } from "@/lib/taken/config";
import { markConverted, noteRest, taskLines } from "@/lib/taken/notes";
import { parseTask } from "@/lib/taken/parse";
import type { Task } from "@/lib/taken/types";
import { ChevronLeftIcon, PinIcon, TrashIcon } from "../../../_components/icons";
import { useTaken } from "../../../_components/TakenContext";

// Notitie-editor: titel + tekst, slaat vanzelf op. "[ ] iets" wordt met één knop een taak.

const LIST_PREFIX = /^(\s*)(- \[[ x→]\] |\[[ x→]\] |[-*•] |(\d+)\. )(.*)$/;

export default function NotePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { notes, loaded, updateNote, removeNote, createNote, addTasks, notify, today } = useTaken();
  const note = notes.find((n) => n.id === params.id);
  const [title, setTitle] = useState("");
  const [rest, setRest] = useState("");
  const [status, setStatus] = useState<"" | "bezig" | "opgeslagen" | "fout">("");
  const ready = useRef(false);
  const lastSaved = useRef<string>("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);

  // Eén keer vullen zodra de notitie geladen is.
  useEffect(() => {
    if (!note || ready.current) return;
    ready.current = true;
    setTitle(note.body.split("\n")[0]);
    setRest(noteRest(note.body));
    lastSaved.current = note.body;
    if (!note.body.trim()) setTimeout(() => titleRef.current?.focus(), 50);
  }, [note]);

  const body = rest ? `${title}\n${rest}` : title;

  const save = useCallback(
    async (value: string) => {
      if (value === lastSaved.current) return;
      setStatus("bezig");
      try {
        await updateNote(params.id, { body: value });
        lastSaved.current = value;
        setStatus("opgeslagen");
      } catch {
        setStatus("fout");
      }
    },
    [params.id, updateNote]
  );

  // Automatisch opslaan, 600 ms na het laatste typen.
  useEffect(() => {
    if (!ready.current) return;
    const timer = setTimeout(() => save(body), 600);
    return () => clearTimeout(timer);
  }, [body, save]);

  // Bij weggaan: laatste wijziging bewaren; een lege notitie verdwijnt vanzelf.
  const latest = useRef({ body, save, removeNote });
  latest.current = { body, save, removeNote };
  useEffect(
    () => () => {
      if (!ready.current) return;
      const { body: b, save: s, removeNote: remove } = latest.current;
      if (!b.trim()) remove(params.id);
      else s(b);
    },
    [params.id]
  );

  // Tekstvak groeit mee met de inhoud; na een lijst-Enter de cursor meteen terugzetten.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    if (pendingCursor.current !== null) {
      el.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [rest]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const pos = el.selectionStart;
    const lineStart = rest.lastIndexOf("\n", pos - 1) + 1;
    const line = rest.slice(lineStart, pos);
    const m = line.match(LIST_PREFIX);
    if (!m) return;
    e.preventDefault();
    const [, indent, prefix, num, content] = m;
    let next: string;
    let cursor: number;
    if (!content.trim()) {
      // Lege lijstregel: lijst stoppen.
      next = rest.slice(0, lineStart) + rest.slice(pos);
      cursor = lineStart;
    } else {
      const continued = num ? `${Number(num) + 1}. ` : prefix.replace(/\[[x→]\]/, "[ ]");
      const insert = `\n${indent}${continued}`;
      next = rest.slice(0, pos) + insert + rest.slice(el.selectionEnd);
      cursor = pos + insert.length;
    }
    pendingCursor.current = cursor;
    setRest(next);
  };

  const open = taskLines(rest);
  const convert = async () => {
    try {
      const inputs = open.map((line) => {
        const { chips, ...fields } = parseTask(line, today);
        return { ...fields, areaId: fields.areaId || note?.areaId || null, source: "notitie", note: `Uit notitie: ${title || "zonder titel"}` } as Partial<Task>;
      });
      const created = await addTasks(inputs);
      setRest(markConverted(rest));
      notify(created.length === 1 ? "1 taak in je Inbox" : `${created.length} taken in je Inbox`);
    } catch (err: any) {
      notify(err.message);
    }
  };

  const remove = () => {
    if (!note) return;
    ready.current = false; // niet nog eens opslaan bij weggaan
    removeNote(note.id);
    router.push("/app/notities");
    const { id, createdAt, updatedAt, ...copy } = { ...note, body };
    notify("Notitie verwijderd", () => createNote(copy));
  };

  if (!note) {
    return (
      <div className="tk-empty">
        {loaded ? "Deze notitie bestaat niet (meer)." : "Laden…"}
        <div className="mt-4">
          <Link href="/app/notities" className="tk-btn tk-btn-ghost">
            Naar notities
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-1">
        <Link href="/app/notities" className="tk-btn tk-btn-quiet tk-btn-sm" style={{ marginLeft: -8 }}>
          <ChevronLeftIcon className="h-4 w-4" /> Notities
        </Link>
        <span className="tk-faint ml-2 text-xs">
          {status === "bezig" ? "Opslaan…" : status === "opgeslagen" ? "Opgeslagen" : status === "fout" ? "Niet opgeslagen" : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={`tk-icon-btn ${note.pinned ? "is-on" : ""}`}
            onClick={() => updateNote(note.id, { pinned: !note.pinned })}
            aria-label={note.pinned ? "Losmaken" : "Vastpinnen"}
            title={note.pinned ? "Losmaken" : "Vastpinnen"}
          >
            <PinIcon />
          </button>
          <button type="button" className="tk-icon-btn" onClick={remove} aria-label="Verwijderen" title="Verwijderen">
            <TrashIcon />
          </button>
        </div>
      </div>

      <input
        ref={titleRef}
        className="tk-note-head"
        value={title}
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            bodyRef.current?.focus();
          }
        }}
        placeholder="Titel"
        aria-label="Titel"
      />

      <div className="tk-pills mt-3 mb-4">
        {AREAS.map((a) => (
          <button
            key={a.id}
            type="button"
            className="tk-pill"
            style={{ height: 24, fontSize: 12 }}
            aria-pressed={note.areaId === a.id}
            onClick={() => updateNote(note.id, { areaId: note.areaId === a.id ? null : a.id })}
          >
            <span className="tk-dot" style={{ background: a.color }} />
            {a.short}
          </button>
        ))}
      </div>

      {open.length > 0 && (
        <div className="tk-banner is-soft mb-4">
          <span className="flex-1">
            {open.length === 1 ? "1 regel" : `${open.length} regels`} met [ ] kan een taak worden
          </span>
          <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={convert}>
            Naar Inbox
          </button>
        </div>
      )}

      <textarea
        ref={bodyRef}
        className="tk-note-body"
        value={rest}
        onChange={(e) => setRest(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={"Begin met typen…\n\n- lijstje\n[ ] wordt een taak"}
        aria-label="Notitie"
      />
    </div>
  );
}
