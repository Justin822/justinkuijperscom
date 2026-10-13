"use client";

import { useAreas } from "./TakenContext";
import type { AreaId } from "@/lib/taken/types";

/**
 * Gebied kiezen met één tik. Twee manieren:
 * - `onPick`: altijd een gebied (bijv. een taak een plek geven);
 * - `onChange`: ook "geen", met `toggle` (nogmaals tikken zet het uit) en `all` (een knop "Alles", voor filters).
 */
export default function AreaPills({
  value,
  onPick,
  onChange,
  toggle,
  all,
  small,
  className = "",
}: {
  value?: AreaId | null;
  onPick?: (id: AreaId) => void;
  onChange?: (id: AreaId | null) => void;
  toggle?: boolean;
  all?: boolean;
  small?: boolean;
  className?: string;
}) {
  const { active, map } = useAreas();
  // Gearchiveerde gebieden kies je niet meer, maar een taak die er nog in staat laat het wel zien.
  const shown = value && map[value]?.archived ? [...active, map[value]] : active;
  const style = small ? { height: 24, fontSize: 12 } : undefined;
  const pick = (id: AreaId) => {
    if (onChange) onChange(toggle && value === id ? null : id);
    else onPick?.(id);
  };
  return (
    <div className={`tk-pills ${className}`} style={small ? { gap: 4 } : undefined}>
      {all && onChange && (
        <button type="button" className="tk-pill" style={style} aria-pressed={!value} onClick={() => onChange(null)}>
          Alles
        </button>
      )}
      {shown.map((a) => (
        <button key={a.id} type="button" className="tk-pill" style={style} aria-pressed={value === a.id} onClick={() => pick(a.id)}>
          <span className="tk-dot" style={{ background: a.color }} />
          {a.short}
        </button>
      ))}
    </div>
  );
}
