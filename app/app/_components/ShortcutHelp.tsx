"use client";

import { useEffect, useRef } from "react";
import { useFocusTrap } from "./useFocusTrap";

// Overzicht van de sneltoetsen (toets ?).

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: "Overal",
    keys: [
      ["⌘K of /", "Zoeken in taken en notities, naar elk scherm"],
      ["N", "Nieuwe taak"],
      ["⌘Z", "Laatste actie ongedaan maken"],
      ["Esc", "Venster sluiten (wijzigingen blijven bewaard)"],
      ["?", "Dit overzicht"],
    ],
  },
  {
    title: "In de agenda",
    keys: [
      ["Tab", "Naar het volgende blok"],
      ["Enter", "Blok openen"],
      ["↑ / ↓", "Kwartier eerder of later"],
      ["Shift + ↑ / ↓", "Korter of langer"],
      ["← / →", "Dag eerder of later"],
      ["Spatie", "Afvinken"],
      ["⌫", "Uit de agenda halen"],
    ],
  },
];

export default function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="tk-overlay" onClick={onClose}>
      <div ref={ref} className="tk-sheet" role="dialog" aria-modal="true" aria-label="Sneltoetsen" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>Sneltoetsen</h2>
          <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={onClose}>
            Sluiten
          </button>
        </div>
        {GROUPS.map((g) => (
          <section key={g.title} className="mt-4">
            <h3 className="tk-label">{g.title}</h3>
            <dl className="mt-1 text-sm">
              {g.keys.map(([key, what]) => (
                <div key={key} className="flex gap-3 py-1">
                  <dt className="w-32 shrink-0">
                    <kbd className="tk-kbd">{key}</kbd>
                  </dt>
                  <dd className="tk-muted">{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
