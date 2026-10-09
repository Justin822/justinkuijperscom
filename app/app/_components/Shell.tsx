"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { DragProvider } from "./calendar/DragLayer";
import CommandPalette from "./CommandPalette";
import FocusBar from "./FocusBar";
import { SearchIcon } from "./icons";
import { EXTRA, NAV } from "./nav";
import { useTaken } from "./TakenContext";
import TaskSheet from "./TaskSheet";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const { tasks, addRef, toast, editing, openTask, palette, openPalette, undoLast } = useTaken();
  const inboxCount = tasks.filter((t) => t.status === "inbox").length;

  // Sneltoetsen: ⌘K of / zoekt, N voegt toe, Escape sluit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest("input, textarea, select, [contenteditable]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette(palette ? null : "search");
        return;
      }
      // ⌘Z: laatste actie (verplaatsen, afvinken, verwijderen) terugdraaien.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        undoLast();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        openPalette("search");
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        if (addRef.current) {
          window.scrollTo({ top: 0 });
          addRef.current.focus();
        } else openPalette("add");
      } else if (e.key === "Escape" && editing) openTask(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addRef, editing, openTask, palette, openPalette, undoLast]);

  // Service worker voor de app op je beginscherm.
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/taken-sw.js", { scope: "/app" }).catch(() => {});
    }
  }, []);

  const current = (href: string) =>
    (href === "/app" ? pathname === "/app" : pathname.startsWith(href)) ? "page" : undefined;

  return (
    <div className="tk-layout">
      <nav className="tk-side" aria-label="Menu">
        <div className="mb-5 flex items-center justify-between px-2.5">
          <span style={{ fontWeight: 650, fontSize: 15, letterSpacing: "-0.02em" }}>Planner</span>
        </div>
        <button type="button" className="tk-side-btn mb-3" onClick={() => openPalette("search")}>
          <SearchIcon />
          Zoeken
          <span className="tk-kbd ml-auto">⌘K</span>
        </button>
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={current(href)}>
            <Icon />
            {label}
            {href === "/app/taken" && inboxCount > 0 && <span className="tk-count">{inboxCount}</span>}
          </Link>
        ))}
        <div className="mt-4" />
        {EXTRA.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={current(href)}>
            <Icon />
            {label}
          </Link>
        ))}
        <div className="tk-faint mt-auto px-2.5 text-xs leading-6">
          <span className="tk-kbd">N</span> nieuwe taak
          <br />
          <span className="tk-kbd">/</span> zoeken
        </div>
      </nav>
      <main className={`tk-main ${pathname === "/app" ? "is-wide" : pathname.startsWith("/app/week") ? "is-full" : ""}`}>
        <DragProvider>{children}</DragProvider>
      </main>
      <nav className="tk-bottom" aria-label="Menu">
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={current(href)}>
            <Icon />
            <span>{label}</span>
            {href === "/app/taken" && inboxCount > 0 && <span className="tk-count">{inboxCount}</span>}
          </Link>
        ))}
      </nav>
      <FocusBar />
      {editing && <TaskSheet id={editing} />}
      {palette && <CommandPalette />}
      {toast && (
        <div className="tk-toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button type="button" onClick={toast.undo}>
              Ongedaan maken
            </button>
          )}
        </div>
      )}
    </div>
  );
}
