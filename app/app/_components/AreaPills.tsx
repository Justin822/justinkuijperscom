"use client";

import { AREAS } from "@/lib/taken/config";
import type { AreaId } from "@/lib/taken/types";

// Snel een gebied kiezen met één tik.
export default function AreaPills({
  value,
  onPick,
}: {
  value?: AreaId | null;
  onPick: (id: AreaId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {AREAS.map((a) => (
        <button
          key={a.id}
          type="button"
          className="tk-chip"
          onClick={() => onPick(a.id)}
          style={
            value === a.id
              ? { background: a.color, color: "#fff" }
              : { border: `1px solid ${a.color}55`, background: "transparent", color: "var(--text)" }
          }
        >
          <span className="tk-dot" style={{ background: value === a.id ? "#fff" : a.color }} />
          {a.short}
        </button>
      ))}
    </div>
  );
}
