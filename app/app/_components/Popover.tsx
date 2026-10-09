"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Klein venster naast iets wat je aanklikt; op een telefoon als sheet van onderen.
// Sluit met Esc of een tik ernaast.

export type Anchor = { left: number; top: number; right: number; bottom: number };

export const anchorOf = (el: Element): Anchor => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

export const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

export default function Popover({
  anchor,
  onClose,
  children,
  width = 300,
  label,
}: {
  anchor: Anchor;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [phone] = useState(isPhone);

  useLayoutEffect(() => {
    if (phone || !ref.current) return;
    const h = ref.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Liefst rechts naast het anker, anders links, anders eronder.
    let left = anchor.right + 8;
    if (left + width > vw - 8) left = anchor.left - width - 8;
    if (left < 8) left = Math.min(Math.max(8, anchor.left), vw - width - 8);
    let top = anchor.top;
    if (top + h > vh - 8) top = Math.max(8, vh - h - 8);
    setPos({ left, top });
  }, [anchor, width, phone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    // Uitgesteld, zodat de klik die het venster opent het niet meteen sluit.
    const timer = setTimeout(() => window.addEventListener("pointerdown", onDown, true), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  if (phone) {
    return (
      <div className="tk-overlay" style={{ background: "rgba(0,0,0,0.25)" }}>
        <div ref={ref} className="tk-sheet tk-pop-sheet" role="dialog" aria-label={label}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className="tk-pop"
      role="dialog"
      aria-label={label}
      style={{ width, left: pos?.left ?? anchor.right + 8, top: pos?.top ?? anchor.top, visibility: pos ? "visible" : "hidden" }}
    >
      {children}
    </div>
  );
}

/** Eenvoudig menu met acties in een popover. */
export function Menu({
  anchor,
  onClose,
  items,
}: {
  anchor: Anchor;
  onClose: () => void;
  items: { label: string; onSelect: () => void; danger?: boolean; hint?: string }[];
}) {
  return (
    <Popover anchor={anchor} onClose={onClose} width={240} label="Menu">
      <div className="tk-menu">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={item.danger ? "is-danger" : ""}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            <span>{item.label}</span>
            {item.hint && <span className="tk-faint text-xs">{item.hint}</span>}
          </button>
        ))}
      </div>
    </Popover>
  );
}
