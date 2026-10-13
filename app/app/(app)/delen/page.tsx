"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toCapture } from "@/lib/taken/capture-parse";
import { parseTask, splitEntries } from "@/lib/taken/parse";
import PageHeader from "../../_components/PageHeader";
import { useAreas, useTakenActions, useTakenData } from "../../_components/TakenContext";

// Gedeeld vanuit een andere app (Android-deelmenu, zie share_target in het manifest).
// Je ziet eerst wat er herkend is en past het eventueel aan; dan staat het met één tik in je Inbox.

const URL_RE = /https?:\/\/\S+/i;

export default function SharePage() {
  const router = useRouter();
  const params = useSearchParams();
  const { today } = useTakenData();
  const { addTasks, createNote, notify } = useTakenActions();

  const shared = useMemo(() => {
    const title = (params?.get("title") || "").trim();
    const text = (params?.get("text") || "").trim();
    const url = (params?.get("url") || "").trim() || text.match(URL_RE)?.[0] || "";
    const rest = url ? text.replace(url, "").trim() : text;
    // Veel apps sturen "Titel https://…" als tekst; dan is de titel de rest van de tekst.
    return { url, text: rest || title || "" };
  }, [params]);

  const [text, setText] = useState(shared.text);
  const [busy, setBusy] = useState(false);
  const { list: areas } = useAreas();
  const capture = useMemo(() => toCapture({ text, url: shared.url }, today, "gedeeld", areas), [text, shared.url, today, areas]);
  const preview = useMemo(
    () => (capture.kind === "taken" ? splitEntries(text).map((line) => parseTask(line, today, areas)).filter((p) => p.title) : []),
    [capture.kind, text, today, areas]
  );

  const save = async () => {
    if (busy || capture.kind === "leeg") return;
    setBusy(true);
    try {
      if (capture.kind === "notitie") {
        await createNote({ body: [capture.body, shared.url].filter(Boolean).join("\n\n") });
        notify("Notitie bewaard");
        router.replace("/app/notities");
      } else {
        const created = await addTasks(capture.tasks);
        notify(created.length === 1 ? "In je Inbox gezet" : `${created.length} taken in je Inbox`);
        router.replace("/app/taken?lijst=inbox");
      }
    } catch (err: any) {
      notify(err.message);
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Gedeeld" title="Naar je Planner" />
      <form
        className="tk-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <textarea
          className="tk-input"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Wat moet je ermee? Bijv. Lezen vrijdag, Appèl, half uur"
          aria-label="Gedeelde tekst"
          autoFocus
        />
        {shared.url && (
          <div className="tk-faint mt-2 truncate text-xs" title={shared.url}>
            Link: {shared.url}
          </div>
        )}
        {capture.kind === "notitie" && <div className="tk-muted mt-3 text-sm">Wordt een notitie.</div>}
        {preview.map((p, i) => (
          <div key={i} className="mt-3">
            <div style={{ fontWeight: 550 }}>{p.title}</div>
            {p.chips.length > 0 && (
              <div className="tk-tags">
                {p.chips.map((c, j) => (
                  <span key={j} className="tk-tag">
                    {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="mt-4 flex gap-2">
          <button type="submit" className="tk-btn flex-1" disabled={busy || capture.kind === "leeg"}>
            {busy ? "Bezig…" : capture.kind === "notitie" ? "Bewaar notitie" : "Zet in Inbox"}
          </button>
          <button type="button" className="tk-btn tk-btn-ghost" onClick={() => router.replace("/app")}>
            Annuleren
          </button>
        </div>
      </form>
    </div>
  );
}
