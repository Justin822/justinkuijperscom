"use client";

import { useEffect } from "react";

// Toetsenbord en schermlezers in vensters: de focus gaat erin, Tab blijft erin,
// en na sluiten komt de focus terug waar hij was (bijv. op de taak die je opende).

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(ref: React.RefObject<HTMLElement>, active = true) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) || []).filter((el) => el.offsetParent !== null);
    // Na de eerste weergave: tenzij iets in het venster al focus heeft (autoFocus), het eerste veld.
    const timer = setTimeout(() => {
      if (ref.current && !ref.current.contains(document.activeElement)) (items()[0] || ref.current).focus();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !ref.current) return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
