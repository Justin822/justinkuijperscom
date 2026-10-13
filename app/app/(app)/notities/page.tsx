"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AREA_BY_ID } from "@/lib/taken/config";
import { formatRelative, localToday } from "@/lib/taken/dates";
import { dailyTitle, noteTitle, notePreview } from "@/lib/taken/notes";
import type { AreaId, Note } from "@/lib/taken/types";
import AreaPills from "../../_components/AreaPills";
import { PinIcon, PlusIcon, SearchIcon } from "../../_components/icons";
import PageHeader from "../../_components/PageHeader";
import { useTakenActions, useTakenData } from "../../_components/TakenContext";
import { searchable } from "@/lib/taken/text";


export default function NotesPage() {
  const router = useRouter();
  const { notes, loaded, today } = useTakenData();
  const { createNote, notify } = useTakenActions();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<AreaId | null>(null);

  const visible = useMemo(() => {
    const q = searchable(query.trim());
    return notes
      .filter((n) => (!area || n.areaId === area) && (!q || searchable(n.body).includes(q)))
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
      <AreaPills className="mt-3" value={area} onChange={setArea} toggle all />

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
