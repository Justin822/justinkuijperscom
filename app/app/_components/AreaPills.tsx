"use client";

import { AREAS } from "@/lib/taken/config";
import type { AreaId } from "@/lib/taken/types";

// Gebied kiezen met één tik.
export default function AreaPills({
  value,
  onPick,
}: {
  value?: AreaId | null;
  onPick: (id: AreaId) => void;
}) {
  return (
    <div className="tk-pills">
      {AREAS.map((a) => (
        <button key={a.id} type="button" className="tk-pill" aria-pressed={value === a.id} onClick={() => onPick(a.id)}>
          <span className="tk-dot" style={{ background: a.color }} />
          {a.short}
        </button>
      ))}
    </div>
  );
}
