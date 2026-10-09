"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CloudIcon, GridIcon, HourglassIcon, InboxIcon, MoonIcon, SunIcon } from "./icons";
import QuickAdd from "./QuickAdd";
import { useTaken } from "./TakenContext";
import TaskSheet from "./TaskSheet";

const NAV = [
  { href: "/app", label: "Vandaag", Icon: SunIcon },
  { href: "/app/inbox", label: "Inbox", Icon: InboxIcon },
  { href: "/app/gebieden", label: "Gebieden", Icon: GridIcon },
  { href: "/app/wachten", label: "Wachten op", Icon: HourglassIcon },
  { href: "/app/ooit", label: "Ooit", Icon: CloudIcon },
  { href: "/app/afsluiten", label: "Afsluiten", Icon: MoonIcon, desktopOnly: true },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tasks, addRef, toast, editing, openTask } = useTaken();
  const inboxCount = tasks.filter((t) => t.status === "inbox").length;

  // Sneltoets: N opent overal het invoerveld, Escape sluit de taak.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest("input, textarea, select, [contenteditable]");
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        window.scrollTo({ top: 0 });
        addRef.current?.focus();
      }
      if (e.key === "Escape" && editing) openTask(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addRef, editing, openTask]);

  // Service worker voor de app op je beginscherm.
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/taken-sw.js", { scope: "/app" }).catch(() => {});
    }
  }, []);

  const current = (href: string) =>
    (href === "/app" ? pathname === "/app" : pathname?.startsWith(href)) ? "page" : undefined;

  const links = (where: "side" | "bottom") =>
    NAV.filter((n) => where === "side" || !n.desktopOnly).map(({ href, label, Icon }) => (
      <Link key={href} href={href} aria-current={current(href)}>
        <Icon />
        <span>{where === "bottom" && label === "Wachten op" ? "Wachten" : label}</span>
        {href === "/app/inbox" && inboxCount > 0 && <span className="tk-badge">{inboxCount}</span>}
      </Link>
    ));

  return (
    <div className="tk-layout">
      <nav className="tk-side" aria-label="Menu">
        <div style={{ padding: "0 10px 18px", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>
          Taken
        </div>
        {links("side")}
        <div className="tk-faint" style={{ marginTop: "auto", padding: "0 10px", fontSize: 12.5 }}>
          <span className="tk-kbd">N</span> nieuwe taak
        </div>
      </nav>
      <main className="tk-main">
        <QuickAdd />
        {children}
      </main>
      <nav className="tk-bottom" aria-label="Menu">
        {links("bottom")}
      </nav>
      {editing && <TaskSheet id={editing} />}
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
