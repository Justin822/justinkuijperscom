"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AREA_BY_ID, AREAS } from "@/lib/taken/config";
import { formatRelative, localToday } from "@/lib/taken/dates";
import { dailyTitle, noteTitle, notePreview } from "@/lib/taken/notes";
import type { AreaId, Note } from "@/lib/taken/types";
import { PinIcon, PlusIcon, SearchIcon } from "../../_components/icons";
import PageHeader from "../../_components/PageHeader";
import { useTaken } from "../../_components/TakenContext";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function NotesPage() {
  const router = useRouter();
  const { notes, loaded, createNote, today, notify } = useTaken();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<AreaId | null>(null);

  const visible = useMemo(() => {
    const q = norm(query.trim());
    return notes
      .filter((n) => (!area || n.areaId === area) && (!q || norm(n.body).includes(q)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, query, area]);
  const pinned = visible.filter((n) => n.pinned);
  const rest = visible.filter((n) => !n.pinned);

  const create = async (body = "") => {
    try {
      const note = await createNote({ body, areaId: area });
      router.push(`/app/notities/${note.id}`);
    } catch (err: any) {
      notify(err.message);
    }
  };
  const openDaily = () => {
    const title = dailyTitle(today);
    const existing = notes.find((n) => noteTitle(n) === title);
    if (existing) router.push(`/app/notities/${existing.id}`);
    else create(`${title}\n`);
  };

  const row = (n: Note) => {
    const a = n.areaId ? AREA_BY_ID[n.areaId] : null;
    const preview = notePreview(n);
    return (
      <Link key={n.id} href={`/app/notities/${n.id}`} className="tk-note-row">
        <div className="flex items-center gap-2">
          <div className="tk-note-title min-w-0 flex-1">{noteTitle(n)}</div>
          {n.pinned && <PinIcon className="h-3.5 w-3.5 shrink-0 tk-faint" />}
        </div>
        <div className="tk-note-preview">
          <span className="tk-faint">{formatRelative(localToday(n.updatedAt), today)}</span>
          {a && (
            <>
              {"  "}
              <span className="tk-dot" style={{ background: a.color, margin: "0 4px 1px 6px", verticalAlign: "middle" }} />
              <span className="tk-faint">{a.short}</span>
            </>
          )}
          {preview && <span>{"  "}{preview}</span>}
        </div>
      </Link>
    );
  };

  return (
    <div>
      <PageHeader title="Notities">
        <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={openDaily}>
          Dagnotitie
        </button>
        <button type="button" className="tk-btn tk-btn-sm" onClick={() => create()}>
          <PlusIcon className="h-4 w-4" /> Nieuw
        </button>
      </PageHeader>

      <label className="tk-add-box" style={{ height: 40 }}>
        <SearchIcon className="h-4 w-4 tk-faint" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek in notities" aria-label="Zoek in notities" />
      </label>
      <div className="tk-pills mt-3">
        <button type="button" className="tk-pill" aria-pressed={!area} onClick={() => setArea(null)}>
          Alles
        </button>
        {AREAS.map((a) => (
          <button
            key={a.id}
            type="button"
            className="tk-pill"
            aria-pressed={area === a.id}
            onClick={() => setArea(area === a.id ? null : a.id)}
          >
            <span className="tk-dot" style={{ background: a.color }} />
            {a.short}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="tk-empty">Laden…</div>
      ) : visible.length === 0 ? (
        <div className="tk-empty">
          {query || area ? "Niets gevonden." : "Nog geen notities. Begin met een dagnotitie voor je meetings en gedachten."}
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="tk-section" style={{ marginTop: 24 }}>
              <h2 className="tk-h2">Vastgepind</h2>
              <div>{pinned.map(row)}</div>
            </section>
          )}
          {rest.length > 0 && (
            <section className="tk-section" style={{ marginTop: 24 }}>
              {pinned.length > 0 && <h2 className="tk-h2">Overig</h2>}
              <div>{rest.map(row)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
