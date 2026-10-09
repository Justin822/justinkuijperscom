"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS_LABEL } from "@/lib/taken/config";
import { dailyTitle, noteTitle, notePreview } from "@/lib/taken/notes";
import { parseTask, splitEntries } from "@/lib/taken/parse";
import type { Task } from "@/lib/taken/types";
import { NoteIcon, PlayIcon, PlusIcon, SearchIcon } from "./icons";
import { EXTRA, NAV } from "./nav";
import { useTaken } from "./TakenContext";

// ⌘K: zoeken in taken en notities, iets toevoegen of naar een scherm gaan.

type Item = {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  run: () => void;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function CommandPalette() {
  const router = useRouter();
  const { palette, openPalette, tasks, notes, addTasks, createNote, openTask, startFocus, today, notify, plan } = useTaken();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const adding = palette === "add";

  useEffect(() => inputRef.current?.focus(), []);
  const close = () => openPalette(null);

  const openDaily = async () => {
    const title = dailyTitle(today);
    const existing = notes.find((n) => noteTitle(n) === title);
    const note = existing || (await createNote({ body: `${title}\n` }));
    router.push(`/app/notities/${note.id}`);
  };

  const items = useMemo<Item[]>(() => {
    const q = norm(query.trim());
    const list: Item[] = [];
    const entries = query.trim() ? splitEntries(query).map((e) => parseTask(e, today)).filter((p) => p.title) : [];

    if (entries.length && (adding || q)) {
      list.push({
        id: "add",
        group: "Toevoegen",
        label: entries.length > 1 ? `${entries.length} taken toevoegen` : `Taak: ${entries[0].title}`,
        sub: entries[0].chips.map((c) => c.label).join(" · "),
        icon: <PlusIcon />,
        run: async () => {
          await addTasks(entries.map(({ chips, ...fields }) => fields as Partial<Task>));
          notify(entries.length > 1 ? `${entries.length} taken toegevoegd` : "Taak toegevoegd");
        },
      });
    }
    if (adding) return list;

    if (q) {
      const match = (s: string | null | undefined) => Boolean(s && norm(s).includes(q));
      tasks
        .filter((t) => match(t.title) || match(t.project) || match(t.note) || match(t.waitingOn))
        .sort((a, b) => Number(a.status === "af") - Number(b.status === "af") || b.updatedAt - a.updatedAt)
        .slice(0, 6)
        .forEach((t) =>
          list.push({
            id: `t-${t.id}`,
            group: "Taken",
            label: t.title,
            sub: STATUS_LABEL[t.status],
            icon: <SearchIcon />,
            run: () => openTask(t.id),
          })
        );
      notes
        .filter((n) => match(n.body))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 6)
        .forEach((n) =>
          list.push({
            id: `n-${n.id}`,
            group: "Notities",
            label: noteTitle(n),
            sub: notePreview(n).slice(0, 40),
            icon: <NoteIcon />,
            run: () => router.push(`/app/notities/${n.id}`),
          })
        );
    }

    const commands: Item[] = [
      {
        id: "new-task",
        group: "Acties",
        label: "Nieuwe taak",
        icon: <PlusIcon />,
        run: () => setTimeout(() => openPalette("add"), 0),
      },
      {
        id: "new-note",
        group: "Acties",
        label: "Nieuwe notitie",
        icon: <NoteIcon />,
        run: async () => router.push(`/app/notities/${(await createNote({ body: "" })).id}`),
      },
      { id: "daily", group: "Acties", label: "Dagnotitie van vandaag", icon: <NoteIcon />, run: openDaily },
      ...(plan?.top3 || [])
        .map((p) => tasks.find((t) => t.id === p.id))
        .filter((t): t is Task => Boolean(t && t.status !== "af"))
        .map((t) => ({
          id: `focus-${t.id}`,
          group: "Acties",
          label: `Focus: ${t.title}`,
          sub: "25 min",
          icon: <PlayIcon />,
          run: () => startFocus(t.id, 25),
        })),
      ...NAV.map(({ href, label, Icon }) => ({
        id: href,
        group: "Ga naar",
        label,
        icon: <Icon />,
        run: () => router.push(href),
      })),
      ...EXTRA.map(({ href, label, Icon }) => ({
        id: href,
        group: "Ga naar",
        label: href === "/app/instellingen" ? "Instellingen en agenda's koppelen" : label,
        icon: <Icon />,
        run: () => router.push(href),
      })),
    ];
    list.push(...commands.filter((c) => !q || norm(c.label).includes(q)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, adding, tasks, notes, today, plan]);

  useEffect(() => setIndex(0), [query, adding]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const run = (item?: Item) => {
    if (!item) return;
    close();
    item.run();
  };

  let lastGroup = "";
  return (
    <div className="tk-overlay is-top" onClick={close}>
      <div className="tk-palette" role="dialog" aria-label="Zoeken" onClick={(e) => e.stopPropagation()}>
        <div className="tk-palette-input">
          {adding ? <PlusIcon /> : <SearchIcon />}
          <input
            ref={inputRef}
            className="tk-input-bare"
            style={{ fontSize: 16 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={adding ? "Nieuwe taak, bijv. Factuur sturen vrijdag, Felicio" : "Zoek of typ een opdracht…"}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(items[index]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
            aria-label={adding ? "Nieuwe taak" : "Zoeken"}
            autoComplete="off"
            enterKeyHint="go"
          />
          <span className="tk-kbd tk-desktop-only">esc</span>
        </div>
        <div className="tk-palette-list" ref={listRef} role="listbox">
          {items.length === 0 && (
            <div className="tk-empty" style={{ padding: 20 }}>
              {adding ? "Typ een taak, bijv. 'Offerte Jansen vrijdag, Appèl'" : "Niets gevonden"}
            </div>
          )}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {header && <div className="tk-palette-group">{header}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  className="tk-palette-item"
                  onMouseMove={() => setIndex(i)}
                  onClick={() => run(item)}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                  {item.sub && <span className="tk-sub">{item.sub}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
