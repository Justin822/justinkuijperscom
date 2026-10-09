"use client";

import { SearchIcon } from "./icons";
import { useTaken } from "./TakenContext";

// Kop van een scherm: klein label, titel en acties. Op mobiel altijd een zoekknop.
export default function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { openPalette } = useTaken();
  return (
    <header className="tk-page-head">
      <div className="min-w-0">
        {eyebrow && <div className="tk-eyebrow first-letter:uppercase">{eyebrow}</div>}
        <h1 className="tk-h1">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {children}
        <button
          type="button"
          className="tk-icon-btn tk-mobile-only"
          onClick={() => openPalette("search")}
          aria-label="Zoeken"
        >
          <SearchIcon />
        </button>
      </div>
    </header>
  );
}
