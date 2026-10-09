"use client";

import { addDays } from "@/lib/taken/dates";
import TaskRow from "../../_components/TaskRow";
import { useTaken } from "../../_components/TakenContext";

export default function WaitingPage() {
  const { tasks, loaded, updateTask, today } = useTaken();
  const waiting = tasks
    .filter((t) => t.status === "wachten")
    .sort((a, b) => (a.followUp || "9999").localeCompare(b.followUp || "9999") || a.createdAt - b.createdAt);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <header>
        <h1 className="tk-h1">Wachten op</h1>
        <p className="tk-muted mt-1 text-sm">
          Taken waarvoor je op iemand anders wacht. Geef ze een datum om na te bellen; die verschijnt op Vandaag.
        </p>
      </header>
      <div className="tk-card tk-list px-3">
        {!loaded ? (
          <div className="tk-empty">Laden…</div>
        ) : waiting.length === 0 ? (
          <div className="tk-empty">Je wacht nergens op.</div>
        ) : (
          waiting.map((task) => (
            <TaskRow key={task.id} task={task}>
              <div className="flex flex-wrap items-center gap-1.5">
                {!task.followUp && (
                  <button
                    type="button"
                    className="tk-btn tk-btn-ghost tk-btn-sm"
                    onClick={() => updateTask(task.id, { followUp: addDays(today, 3) })}
                  >
                    Nabellen over 3 dagen
                  </button>
                )}
                {task.followUp && task.followUp <= today && (
                  <button
                    type="button"
                    className="tk-btn tk-btn-ghost tk-btn-sm"
                    onClick={() => updateTask(task.id, { followUp: addDays(today, 3) })}
                  >
                    Nagebeld, over 3 dagen weer
                  </button>
                )}
                <button
                  type="button"
                  className="tk-btn tk-btn-ghost tk-btn-sm"
                  onClick={() => updateTask(task.id, { status: task.areaId ? "gepland" : "inbox", followUp: null })}
                >
                  Binnen, weer oppakken
                </button>
              </div>
            </TaskRow>
          ))
        )}
      </div>
    </div>
  );
}
