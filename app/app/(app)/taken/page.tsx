"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AREA_BY_ID, AREAS } from "@/lib/taken/config";
import { addDays } from "@/lib/taken/dates";
import type { AreaId, Task } from "@/lib/taken/types";
import { SearchIcon } from "../../_components/icons";
import InboxActions from "../../_components/InboxActions";
import PageHeader from "../../_components/PageHeader";
import QuickAdd from "../../_components/QuickAdd";
import TaskRow from "../../_components/TaskRow";
import { useTaken } from "../../_components/TakenContext";

// Eén tab voor alle taken: Inbox, Open (per gebied en project), Wachten op, Ooit en Af.

type List = "inbox" | "open" | "wachten" | "ooit" | "af";
const LISTS: { id: List; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "open", label: "Open" },
  { id: "wachten", label: "Wachten op" },
  { id: "ooit", label: "Ooit" },
  { id: "af", label: "Af" },
];

const STATUS_ORDER: Record<Task["status"], number> = { bezig: 0, gepland: 1, inbox: 2, wachten: 3, ooit: 4, af: 5 };
const byUrgency = (a: Task, b: Task) =>
  STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
  (a.deadline || "9999").localeCompare(b.deadline || "9999") ||
  (a.planDate || "9999").localeCompare(b.planDate || "9999") ||
  a.createdAt - b.createdAt;

const inList = (t: Task, list: List) =>
  list === "open" ? t.status === "gepland" || t.status === "bezig" : t.status === list;

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function TasksPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { tasks, loaded, updateTask, today } = useTaken();
  const list = (LISTS.find((l) => l.id === params?.get("lijst"))?.id || (tasks.some((t) => t.status === "inbox") ? "inbox" : "open")) as List;
  const [area, setArea] = useState<AreaId | "geen" | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const setList = (id: List) => router.replace(`${pathname}?lijst=${id}`);

  const visible = useMemo(() => {
    const q = norm(query.trim());
    return tasks
      .filter((t) => inList(t, list))
      .filter((t) => !area || (area === "geen" ? !t.areaId : t.areaId === area))
      .filter((t) => !q || norm(`${t.title} ${t.project || ""} ${t.note || ""} ${t.waitingOn || ""}`).includes(q))
      .sort(
        list === "af"
          ? (a, b) => (b.doneAt || 0) - (a.doneAt || 0)
          : list === "inbox" || list === "ooit"
          ? (a, b) => a.createdAt - b.createdAt
          : list === "wachten"
          ? (a, b) => (a.followUp || "9999").localeCompare(b.followUp || "9999")
          : byUrgency
      );
  }, [tasks, list, area, query]);

  const counts = Object.fromEntries(LISTS.map((l) => [l.id, tasks.filter((t) => inList(t, l.id)).length])) as Record<List, number>;

  // Open: groeperen per gebied, dan per project.
  const groups = useMemo(() => {
    if (list !== "open") return [];
    const map = new Map<string, Task[]>();
    for (const t of visible) {
      const key = `${t.areaId || "geen"}|${t.project || ""}`;
      map.set(key, [...(map.get(key) || []), t]);
    }
    const order = [...AREAS.map((a) => a.id as string), "geen"];
    return Array.from(map.entries()).sort(([a], [b]) => {
      const [aa, ap] = a.split("|");
      const [ba, bp] = b.split("|");
      return order.indexOf(aa) - order.indexOf(ba) || (ap ? (bp ? ap.localeCompare(bp) : -1) : bp ? 1 : 0);
    });
  }, [visible, list]);

  const rowFor = (task: Task) => {
    if (list === "inbox")
      return (
        <TaskRow
          key={task.id}
          task={task}
          hideArea={expanded === task.id}
          onOpen={expanded === task.id ? undefined : () => setExpanded(task.id)}
        >
          {expanded === task.id ? <InboxActions task={task} /> : null}
        </TaskRow>
      );
    if (list === "wachten")
      return (
        <TaskRow key={task.id} task={task}>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="tk-btn tk-btn-ghost tk-btn-sm"
              onClick={() => updateTask(task.id, { followUp: addDays(today, 3) })}
            >
              {task.followUp && task.followUp <= today ? "Nagebeld, over 3 dagen weer" : "Nabellen over 3 dagen"}
            </button>
            <button
              type="button"
              className="tk-btn tk-btn-quiet tk-btn-sm"
              onClick={() => updateTask(task.id, { status: task.areaId ? "gepland" : "inbox", followUp: null })}
            >
              Binnen
            </button>
          </div>
        </TaskRow>
      );
    if (list === "ooit")
      return (
        <TaskRow
          key={task.id}
          task={task}
          actions={
            <button
              type="button"
              className="tk-btn tk-btn-quiet tk-btn-sm"
              onClick={() => updateTask(task.id, { status: task.areaId ? "gepland" : "inbox" })}
            >
              Activeren
            </button>
          }
        />
      );
    return <TaskRow key={task.id} task={task} hideArea={list === "open"} />;
  };

  const empty: Record<List, string> = {
    inbox: "Inbox is leeg.",
    open: "Geen open taken.",
    wachten: "Je wacht nergens op.",
    ooit: "Nog leeg. Typ 'ooit' in een taak om hem hier te zetten.",
    af: "Nog niets afgerond de laatste 30 dagen.",
  };

  return (
    <div>
      <PageHeader title="Taken" />
      <QuickAdd />

      <div className="tk-tabs mt-4" role="tablist">
        {LISTS.map((l) => (
          <button key={l.id} type="button" role="tab" aria-selected={list === l.id} onClick={() => setList(l.id)}>
            {l.label}
            {l.id !== "af" && counts[l.id] > 0 && <span className="tk-num">{counts[l.id]}</span>}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="tk-pills">
          <button type="button" className="tk-pill" aria-pressed={!area} onClick={() => setArea(null)}>
            Alles
          </button>
          {AREAS.map((a) => (
            <button
              key={a.id}
              type="button"
              className="tk-pill"
              aria-pressed={area === a.id}
              onClick={() => setArea(area === a.id ? null : a.id)}
            >
              <span className="tk-dot" style={{ background: a.color }} />
              {a.short}
            </button>
          ))}
        </div>
        <label className="ml-auto flex h-7 items-center gap-1.5 tk-faint" style={{ minWidth: 140 }}>
          <SearchIcon className="h-4 w-4" />
          <input
            className="tk-input-bare text-sm"
            placeholder="Filter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter taken"
          />
        </label>
      </div>

      <div className="mt-2">
        {!loaded ? (
          <div className="tk-empty">Laden…</div>
        ) : visible.length === 0 ? (
          <div className="tk-empty">{query || area ? "Niets gevonden met dit filter." : empty[list]}</div>
        ) : list === "open" ? (
          groups.map(([key, items]) => {
            const [areaId, project] = key.split("|");
            const a = AREA_BY_ID[areaId as AreaId];
            return (
              <section key={key} className="mt-5">
                <div className="tk-h2 flex items-center gap-2">
                  {a && <span className="tk-dot" style={{ background: a.color }} />}
                  {a ? a.name : "Zonder gebied"}
                  {project && <span className="tk-faint">/ {project}</span>}
                </div>
                <div className="tk-list">{items.map(rowFor)}</div>
              </section>
            );
          })
        ) : (
          <div className="tk-list">{visible.map(rowFor)}</div>
        )}
      </div>
      {list === "inbox" && visible.length > 0 && (
        <p className="tk-faint mt-4 text-xs">Tik op een taak om hem een plek te geven.</p>
      )}
    </div>
  );
}
