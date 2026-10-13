"use client";

import { useState } from "react";
import type { Area } from "@/lib/taken/config";

// Je gebieden aanpassen: naam, korte naam, kleur, trefwoorden, volgorde en archiveren.
// Wijzigingen gaan pas mee bij "Opslaan"; de server kijkt ze na (cleanAreas).

type Draft = Omit<Area, "keywords" | "strong"> & { keywords: string; strong: string };

const toDraft = (a: Area): Draft => ({ ...a, keywords: a.keywords.join(", "), strong: a.strong.join(", ") });
const fromDraft = (d: Draft) => ({ ...d, keywords: d.keywords.split(","), strong: d.strong.split(",") });

export default function AreasEditor({ areas, busy, onSave }: { areas: Area[]; busy: boolean; onSave: (areas: unknown[]) => Promise<boolean> }) {
  const [draft, setDraft] = useState<Draft[]>(() => areas.map(toDraft));
  const [dirty, setDirty] = useState(false);

  const change = (i: number, patch: Partial<Draft>) => {
    setDraft((list) => list.map((a, j) => (j === i ? { ...a, ...patch } : a)));
    setDirty(true);
  };
  const move = (i: number, by: number) => {
    setDraft((list) => {
      const next = [...list];
      const [item] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item);
      return next;
    });
    setDirty(true);
  };
  const add = () => {
    setDraft((list) => [...list, { id: "", name: "", short: "", color: "#737373", keywords: "", strong: "" }]);
    setDirty(true);
  };

  return (
    <div className="text-sm">
      <div className="flex flex-col gap-3">
        {draft.map((a, i) => (
          <fieldset key={a.id || `nieuw-${i}`} className={`tk-card p-3 ${a.archived ? "opacity-60" : ""}`} aria-label={a.name || "Nieuw gebied"}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={a.color}
                onChange={(e) => change(i, { color: e.target.value })}
                aria-label={`Kleur van ${a.name || "nieuw gebied"}`}
                style={{ width: 32, height: 32, padding: 0, border: 0, background: "none" }}
              />
              <input
                className="tk-input flex-1"
                value={a.name}
                placeholder="Naam, bijv. Sport"
                onChange={(e) => change(i, { name: e.target.value })}
                aria-label="Naam"
              />
              <input
                className="tk-input"
                style={{ maxWidth: 110 }}
                value={a.short}
                placeholder="Kort"
                onChange={(e) => change(i, { short: e.target.value })}
                aria-label={`Korte naam van ${a.name || "nieuw gebied"}`}
              />
            </div>
            <input
              className="tk-input mt-2"
              value={a.keywords}
              placeholder="Trefwoorden, bijv. sport, gym"
              onChange={(e) => change(i, { keywords: e.target.value })}
              aria-label={`Trefwoorden van ${a.name || "nieuw gebied"}`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${a.name} omhoog`}>
                ↑
              </button>
              <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" disabled={i === draft.length - 1} onClick={() => move(i, 1)} aria-label={`${a.name} omlaag`}>
                ↓
              </button>
              <label className="ml-auto flex items-center gap-1.5">
                <input type="checkbox" checked={Boolean(a.archived)} onChange={(e) => change(i, { archived: e.target.checked })} />
                Archiveren
              </label>
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={add}>
          Gebied toevoegen
        </button>
        <button
          type="button"
          className="tk-btn tk-btn-sm"
          disabled={!dirty || busy}
          onClick={async () => {
            if (await onSave(draft.map(fromDraft))) setDirty(false);
          }}
        >
          {busy ? "Opslaan…" : "Gebieden opslaan"}
        </button>
      </div>
      <p className="tk-faint mt-2 text-xs">
        Een trefwoord als los stukje (&quot;…, gym&quot;) of als #tag kiest het gebied in de snelle invoer. Gearchiveerde gebieden kies je niet meer, maar taken houden ze.
      </p>
    </div>
  );
}
