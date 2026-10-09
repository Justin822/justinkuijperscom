"use client";

import { useState } from "react";
import { AREAS } from "@/lib/taken/config";
import type { AreaId, Task } from "@/lib/taken/types";
import TaskRow from "../../_components/TaskRow";
import { useTaken } from "../../_components/TakenContext";

const STATUS_ORDER: Record<Task["status"], number> = { bezig: 0, gepland: 1, inbox: 2, wachten: 3, ooit: 4, af: 5 };

const sortTasks = (a: Task, b: Task) =>
  STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
  (a.deadline || "9999").localeCompare(b.deadline || "9999") ||
  a.createdAt - b.createdAt;

export default function AreasPage() {
  const { tasks, loaded } = useTaken();
  const [selected, setSelected] = useState<AreaId | "geen">("appel");
  const [showDone, setShowDone] = useState(false);

  const inArea = (t: Task) => (selected === "geen" ? !t.areaId : t.areaId === selected);
  const visible = tasks.filter((t) => inArea(t) && t.status !== "ooit" && t.status !== "af").sort(sortTasks);
  const done = tasks
    .filter((t) => inArea(t) && t.status === "af")
    .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const someday = tasks.filter((t) => inArea(t) && t.status === "ooit").length;

  const groups = new Map<string, Task[]>();
  for (const t of visible) {
    const key = t.project || "";
    groups.set(key, [...(groups.get(key) || []), t]);
  }
  const groupKeys = Array.from(groups.keys()).sort((a, b) => (a ? (b ? a.localeCompare(b) : -1) : 1));

  const count = (id: AreaId | "geen") =>
    tasks.filter((t) => (id === "geen" ? !t.areaId : t.areaId === id) && !["af", "ooit"].includes(t.status)).length;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="tk-h1">Gebieden</h1>
      <div className="tk-seg">
        {AREAS.map((a) => (
          <button key={a.id} type="button" aria-pressed={selected === a.id} onClick={() => setSelected(a.id)}>
            <span className="tk-dot mr-1.5 inline-block" style={{ background: a.color }} />
            {a.short} <span className="opacity-60">{count(a.id)}</span>
          </button>
        ))}
        {count("geen") > 0 && (
          <button type="button" aria-pressed={selected === "geen"} onClick={() => setSelected("geen")}>
            Zonder gebied <span className="opacity-60">{count("geen")}</span>
          </button>
        )}
      </div>

      {!loaded ? (
        <div className="tk-empty">Laden…</div>
      ) : visible.length === 0 ? (
        <div className="tk-card tk-empty">Geen open taken in dit gebied.</div>
      ) : (
        groupKeys.map((key) => (
          <section key={key || "_los"}>
            <h2 className="tk-h2 mb-2">{key || "Los"}</h2>
            <div className="tk-card tk-list px-3">
              {(groups.get(key) || []).map((task) => (
                <TaskRow key={task.id} task={task} hideArea />
              ))}
            </div>
          </section>
        ))
      )}

      <div className="tk-faint flex flex-wrap gap-3 text-sm">
        {someday > 0 && <span>{someday} op ooit / misschien</span>}
        {done.length > 0 && (
          <button type="button" className="underline" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Verberg" : "Toon"} {done.length} afgeronde taken
          </button>
        )}
      </div>
      {showDone && done.length > 0 && (
        <div className="tk-card tk-list px-3">
          {done.map((task) => (
            <TaskRow key={task.id} task={task} hideArea />
          ))}
        </div>
      )}
    </div>
  );
}
