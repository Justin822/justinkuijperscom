"use client";

import TaskRow from "../../_components/TaskRow";
import { useTaken } from "../../_components/TakenContext";

export default function SomedayPage() {
  const { tasks, loaded, updateTask } = useTaken();
  const someday = tasks.filter((t) => t.status === "ooit").sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <header>
        <h1 className="tk-h1">Ooit / misschien</h1>
        <p className="tk-muted mt-1 text-sm">Ideeën zonder deadline. Ze komen niet in je top 3 tot je ze activeert.</p>
      </header>
      <div className="tk-card tk-list px-3">
        {!loaded ? (
          <div className="tk-empty">Laden…</div>
        ) : someday.length === 0 ? (
          <div className="tk-empty">
            Nog leeg. Typ &quot;ooit&quot; of #ooit in een taak om hem hier te zetten.
          </div>
        ) : (
          someday.map((task) => (
            <TaskRow key={task.id} task={task}>
              <button
                type="button"
                className="tk-btn tk-btn-ghost tk-btn-sm"
                onClick={() => updateTask(task.id, { status: task.areaId ? "gepland" : "inbox" })}
              >
                Activeren
              </button>
            </TaskRow>
          ))
        )}
      </div>
    </div>
  );
}
