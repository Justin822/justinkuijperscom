"use client";

import { AREA_BY_ID } from "@/lib/taken/config";
import type { Task } from "@/lib/taken/types";
import AreaPills from "./AreaPills";
import { useTaken } from "./TakenContext";

// Een taak uit de Inbox een plek geven: gebied kiezen, of naar wachten / ooit / weg.
export default function InboxActions({ task }: { task: Task }) {
  const { updateTask, removeTask, openTask, notify, today, addTasks } = useTaken();
  const area = task.areaId ? AREA_BY_ID[task.areaId] : null;

  return (
    <div className="flex flex-col gap-2">
      <AreaPills value={task.areaId} onPick={(areaId) => updateTask(task.id, { areaId, status: "gepland" })} />
      <div className="flex flex-wrap gap-1.5">
        {area && (
          <button type="button" className="tk-btn tk-btn-sm" onClick={() => updateTask(task.id, { status: "gepland" })}>
            In {area.short}
          </button>
        )}
        <button
          type="button"
          className="tk-btn tk-btn-ghost tk-btn-sm"
          onClick={() => updateTask(task.id, { status: "gepland", planDate: today })}
        >
          Vandaag
        </button>
        <button
          type="button"
          className="tk-btn tk-btn-ghost tk-btn-sm"
          onClick={() => {
            updateTask(task.id, { status: "wachten" });
            openTask(task.id);
          }}
        >
          Wachten op
        </button>
        <button
          type="button"
          className="tk-btn tk-btn-ghost tk-btn-sm"
          onClick={() => updateTask(task.id, { status: "ooit" })}
        >
          Ooit
        </button>
        <button
          type="button"
          className="tk-btn tk-btn-quiet tk-btn-sm"
          onClick={() => {
            removeTask(task.id);
            const { id: _id, createdAt, updatedAt, doneAt, ...copy } = task;
            notify("Geschrapt", () => addTasks([copy]));
          }}
        >
          Schrappen
        </button>
      </div>
    </div>
  );
}
