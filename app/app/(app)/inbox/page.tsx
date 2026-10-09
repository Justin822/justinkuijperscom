"use client";

import InboxActions from "../../_components/InboxActions";
import TaskRow from "../../_components/TaskRow";
import { useTaken } from "../../_components/TakenContext";

export default function InboxPage() {
  const { tasks, loaded } = useTaken();
  const inbox = tasks.filter((t) => t.status === "inbox").sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <header>
        <h1 className="tk-h1">Inbox</h1>
        <p className="tk-muted mt-1 text-sm">
          Alles wat nog geen plek heeft. Kies een gebied, of zet het op wachten, ooit of weg.
        </p>
      </header>
      <div className="tk-card tk-list px-3">
        {!loaded ? (
          <div className="tk-empty">Laden…</div>
        ) : inbox.length === 0 ? (
          <div className="tk-empty">Inbox is leeg. Lekker.</div>
        ) : (
          inbox.map((task) => (
            <TaskRow key={task.id} task={task} hideArea>
              <InboxActions task={task} />
            </TaskRow>
          ))
        )}
      </div>
    </div>
  );
}
