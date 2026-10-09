"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addDays, localToday } from "@/lib/taken/dates";
import { WORKDAY } from "@/lib/taken/agenda";
import type { CalendarEvent, DayPlan, Note, PublicSettings, Task } from "@/lib/taken/types";

// Alle taken en notities staan in de browser; wijzigingen zijn direct zichtbaar
// en gaan op de achtergrond naar de server (bij een fout terug naar de oude stand).

type Toast = { id: number; text: string; undo?: () => void };

export type Focus = {
  taskId: string;
  minutes: number;
  /** Begin van het lopende stuk (ms), null als gepauzeerd. */
  runningSince: number | null;
  /** Al gewerkte tijd vóór het lopende stuk (ms). */
  elapsed: number;
};

type PaletteMode = "search" | "add";

type Ctx = {
  tasks: Task[];
  notes: Note[];
  loaded: boolean;
  error: string | null;
  today: string;
  addTasks: (inputs: Partial<Task>[]) => Promise<Task[]>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  mergeTasks: (tasks: Task[]) => void;
  reload: () => Promise<void>;
  createNote: (input: Partial<Note>) => Promise<Note>;
  updateNote: (id: string, patch: Partial<Note>) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
  editing: string | null;
  openTask: (id: string | null) => void;
  toast: Toast | null;
  notify: (text: string, undo?: () => void) => void;
  /** Laatste actie met "Ongedaan maken" terugdraaien (⌘Z). */
  undoLast: () => void;
  /** Taak wijzigen met een melding die je ongedaan kunt maken. */
  changeTask: (id: string, patch: Partial<Task>, message: string) => void;
  addRef: React.MutableRefObject<HTMLInputElement | null>;
  plan: DayPlan | null;
  planAction: (action: "swap" | "promote" | "recompute", id?: string) => Promise<void>;
  reloadPlan: () => Promise<void>;
  focus: Focus | null;
  startFocus: (taskId: string, minutes?: number) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  stopFocus: (done?: boolean) => void;
  focusOpen: boolean;
  setFocusOpen: (open: boolean) => void;
  palette: PaletteMode | null;
  openPalette: (mode?: PaletteMode | null) => void;
  settings: PublicSettings | null;
  setSettings: (s: PublicSettings) => void;
  workday: { start: string; end: string };
};

const TakenContext = createContext<Ctx | null>(null);

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (res.status === 401) {
    window.location.href = "/app/toegang";
    throw new Error("Log eerst in.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Er ging iets mis (${res.status}).`);
  return data;
}

const FOCUS_KEY = "tk-focus";
export const focusElapsed = (f: Focus, now = Date.now()) => f.elapsed + (f.runningSince ? now - f.runningSince : 0);

function readFocus(): Focus | null {
  try {
    const raw = localStorage.getItem(FOCUS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeFocus(f: Focus | null) {
  try {
    if (f) localStorage.setItem(FOCUS_KEY, JSON.stringify(f));
    else localStorage.removeItem(FOCUS_KEY);
  } catch {
    // privévenster: timer werkt, maar overleeft geen herlaadbeurt
  }
}

export function TakenProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => localToday());
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [palette, setPalette] = useState<PaletteMode | null>(null);
  // Alleen in de browser renderen: datums en tijden hangen af van de tijdzone van je telefoon,
  // die de server (UTC) niet kent. Zo komen server-HTML en browser nooit uit elkaar.
  const [mounted, setMounted] = useState(false);
  const [settings, setSettingsState] = useState<PublicSettings | null>(null);
  const addRef = useRef<HTMLInputElement | null>(null);
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;
  const notesRef = useRef<Note[]>([]);
  notesRef.current = notes;

  // Acties die je kunt terugdraaien: via de knop in de melding of met ⌘Z.
  const undoStack = useRef<(() => void)[]>([]);
  const notify = useCallback((text: string, undo?: () => void) => {
    const id = Date.now();
    let wrapped: (() => void) | undefined;
    if (undo) {
      let used = false;
      wrapped = () => {
        if (used) return;
        used = true;
        undoStack.current = undoStack.current.filter((u) => u !== wrapped);
        setToast((t) => (t?.id === id ? null : t));
        undo();
      };
      undoStack.current = [...undoStack.current.slice(-19), wrapped];
    }
    setToast({ id, text, undo: wrapped });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), undo ? 5000 : 2800);
  }, []);
  const undoLast = useCallback(() => {
    const last = undoStack.current[undoStack.current.length - 1];
    if (last) last();
  }, []);

  const reload = useCallback(async () => {
    try {
      const [t, n, st] = await Promise.all([
        api<{ tasks: Task[] }>("/api/taken/tasks"),
        api<{ notes: Note[] }>("/api/taken/notes"),
        api<{ settings: PublicSettings }>("/api/taken/settings").catch(() => null),
      ]);
      setTasks(t.tasks);
      setNotes(n.notes);
      if (st) setSettingsState(st.settings);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, []);

  const reloadPlan = useCallback(async () => {
    try {
      const data = await api<{ plan: DayPlan }>(`/api/taken/today?date=${today}`);
      setPlan(data.plan);
    } catch (err: any) {
      notify(err.message);
    }
  }, [today, notify]);

  useEffect(() => {
    setMounted(true);
    reload();
    setFocus(readFocus());
  }, [reload]);

  // Een open tabblad of app springt na middernacht vanzelf naar de nieuwe dag.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      setToday(localToday());
      reload();
    };
    document.addEventListener("visibilitychange", check);
    const timer = setInterval(() => setToday(localToday()), 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      clearInterval(timer);
    };
  }, [reload]);

  const mergeTasks = useCallback((changed: Task[]) => {
    setTasks((list) => {
      const byId = new Map(changed.map((t) => [t.id, t]));
      const merged = list.map((t) => byId.get(t.id) || t);
      for (const t of changed) if (!list.some((x) => x.id === t.id)) merged.push(t);
      return merged;
    });
  }, []);

  const addTasks = useCallback(
    async (inputs: Partial<Task>[]) => {
      const data = await api<{ tasks: Task[]; sync?: string }>("/api/taken/tasks", {
        method: "POST",
        body: JSON.stringify({ tasks: inputs }),
      });
      mergeTasks(data.tasks);
      if (data.sync === "fout") notify("Opgeslagen, maar niet in Google Agenda gezet");
      return data.tasks;
    },
    [mergeTasks, notify]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      const before = tasksRef.current.find((t) => t.id === id);
      if (!before) return;
      const optimistic: Task = { ...before, ...patch, updatedAt: Date.now() };
      if (patch.status === "af" && before.status !== "af") optimistic.doneAt = Date.now();
      mergeTasks([optimistic]);
      try {
        const data = await api<{ task: Task; created?: Task[]; sync?: string }>(`/api/taken/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...patch, today: localToday() }),
        });
        mergeTasks([data.task, ...(data.created || [])]);
        if (data.sync === "fout") notify("Opgeslagen, maar niet in Google Agenda gezet");
      } catch (err: any) {
        mergeTasks([before]);
        notify(err.message);
      }
    },
    [mergeTasks, notify]
  );

  const changeTask = useCallback(
    (id: string, patch: Partial<Task>, message: string) => {
      const before = tasksRef.current.find((t) => t.id === id);
      if (!before) return;
      const previous = Object.fromEntries(Object.keys(patch).map((k) => [k, (before as any)[k]])) as Partial<Task>;
      updateTask(id, patch);
      notify(message, () => updateTask(id, previous));
    },
    [updateTask, notify]
  );

  const removeTask = useCallback(
    async (id: string) => {
      const before = tasksRef.current.find((t) => t.id === id);
      setTasks((list) => list.filter((t) => t.id !== id));
      try {
        await api(`/api/taken/tasks/${id}`, { method: "DELETE" });
      } catch (err: any) {
        if (before) mergeTasks([before]);
        notify(err.message);
      }
    },
    [mergeTasks, notify]
  );

  const createNote = useCallback(async (input: Partial<Note>) => {
    const data = await api<{ note: Note }>("/api/taken/notes", { method: "POST", body: JSON.stringify(input) });
    setNotes((list) => [data.note, ...list]);
    return data.note;
  }, []);

  const updateNote = useCallback(
    async (id: string, patch: Partial<Note>) => {
      setNotes((list) => list.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)));
      try {
        const data = await api<{ note: Note }>(`/api/taken/notes/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        // Alleen metadata overnemen; de tekst in de editor kan intussen verder zijn.
        setNotes((list) => list.map((n) => (n.id === id ? { ...n, updatedAt: data.note.updatedAt } : n)));
      } catch (err: any) {
        notify(err.message);
        throw err;
      }
    },
    [notify]
  );

  const removeNote = useCallback(
    async (id: string) => {
      const before = notesRef.current.find((n) => n.id === id);
      setNotes((list) => list.filter((n) => n.id !== id));
      try {
        await api(`/api/taken/notes/${id}`, { method: "DELETE" });
      } catch (err: any) {
        if (before) setNotes((list) => [before, ...list]);
        notify(err.message);
      }
    },
    [notify]
  );

  const planAction = useCallback(
    async (action: "swap" | "promote" | "recompute", id?: string) => {
      try {
        const data = await api<{ plan: DayPlan }>("/api/taken/today", {
          method: "POST",
          body: JSON.stringify({ action, id, date: today }),
        });
        setPlan(data.plan);
      } catch (err: any) {
        notify(err.message);
      }
    },
    [today, notify]
  );

  // ----- Focus-timer -----
  const saveFocus = useCallback((f: Focus | null) => {
    setFocus(f);
    writeFocus(f);
  }, []);

  const logFocus = useCallback(
    (f: Focus, done: boolean) => {
      const minutes = Math.round(focusElapsed(f) / 60000);
      const task = tasksRef.current.find((t) => t.id === f.taskId);
      if (!task) return;
      const patch: Partial<Task> = {};
      if (minutes > 0) patch.focusMinutes = (task.focusMinutes || 0) + minutes;
      if (done) patch.status = "af";
      if (Object.keys(patch).length) updateTask(task.id, patch);
      if (minutes > 0) notify(`${minutes} min gefocust op ${task.title}`);
    },
    [updateTask, notify]
  );

  const startFocus = useCallback(
    (taskId: string, minutes = 25) => {
      if (focus) logFocus(focus, false);
      saveFocus({ taskId, minutes, runningSince: Date.now(), elapsed: 0 });
      setFocusOpen(true);
      try {
        if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
      } catch {
        // niet ondersteund
      }
    },
    [focus, logFocus, saveFocus]
  );
  const pauseFocus = useCallback(() => {
    if (focus?.runningSince) saveFocus({ ...focus, elapsed: focusElapsed(focus), runningSince: null });
  }, [focus, saveFocus]);
  const resumeFocus = useCallback(() => {
    if (focus && !focus.runningSince) saveFocus({ ...focus, runningSince: Date.now() });
  }, [focus, saveFocus]);
  const stopFocus = useCallback(
    (done = false) => {
      if (focus) logFocus(focus, done);
      saveFocus(null);
      setFocusOpen(false);
    },
    [focus, logFocus, saveFocus]
  );

  const openPalette = useCallback((mode: PaletteMode | null = "search") => setPalette(mode), []);

  // Na een wijziging in de instellingen: agenda's opnieuw ophalen.
  const setSettings = useCallback((s: PublicSettings) => {
    agendaCache.clear();
    setSettingsState(s);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      tasks,
      notes,
      loaded,
      error,
      today,
      addTasks,
      updateTask,
      removeTask,
      mergeTasks,
      reload,
      createNote,
      updateNote,
      removeNote,
      editing,
      openTask: setEditing,
      toast,
      notify,
      undoLast,
      changeTask,
      addRef,
      plan,
      planAction,
      reloadPlan,
      focus,
      startFocus,
      pauseFocus,
      resumeFocus,
      stopFocus,
      focusOpen,
      setFocusOpen,
      palette,
      openPalette,
      settings,
      setSettings,
      workday: settings?.workday || WORKDAY,
    }),
    [
      tasks,
      notes,
      loaded,
      error,
      today,
      addTasks,
      updateTask,
      removeTask,
      mergeTasks,
      reload,
      createNote,
      updateNote,
      removeNote,
      editing,
      toast,
      notify,
      undoLast,
      changeTask,
      plan,
      planAction,
      reloadPlan,
      focus,
      startFocus,
      pauseFocus,
      resumeFocus,
      stopFocus,
      focusOpen,
      palette,
      openPalette,
      settings,
      setSettings,
    ]
  );

  return <TakenContext.Provider value={value}>{mounted ? children : null}</TakenContext.Provider>;
}

export function useTaken() {
  const ctx = useContext(TakenContext);
  if (!ctx) throw new Error("useTaken buiten TakenProvider");
  return ctx;
}

// ----- Agenda -----
type AgendaEntry = { at: number; from: string; to: string; data: AgendaData };
const agendaCache = new Map<string, AgendaEntry>();
const agendaListeners = new Set<() => void>();
let lastAgendaEdit = 0;
export type AgendaData = { events: CalendarEvent[]; configured: boolean; errors: string[]; updatedTasks?: Task[] };

/**
 * Afspraken in alle geladen weergaven aanpassen, direct zichtbaar (vóór Google antwoordt).
 * `range` is de periode van die weergave, zodat een nieuwe afspraak alleen landt waar hij hoort.
 */
export function editAgenda(change: (events: CalendarEvent[], range: { from: string; to: string }) => CalendarEvent[]) {
  lastAgendaEdit = Date.now();
  agendaCache.forEach((entry, key) =>
    agendaCache.set(key, { ...entry, data: { ...entry.data, events: change(entry.data.events, entry) } })
  );
  agendaListeners.forEach((listener) => listener());
}

/** Afspraken tussen twee datums; houdt 2 minuten een cache vast zodat wisselen tussen schermen snel is. */
export function useAgenda(from: string, to: string) {
  const { settings, mergeTasks } = useTaken();
  // Andere instellingen (agenda gekoppeld of aangevinkt) = opnieuw ophalen.
  const version = JSON.stringify([
    settings?.icsSources.map((s) => s.id),
    settings?.google.calendars.filter((c) => c.selected).map((c) => c.id),
    settings?.google.connected,
    settings?.google.canEdit,
  ]);
  const key = `${from}|${to}|${version}`;
  const [data, setData] = useState<AgendaData | null>(() => agendaCache.get(key)?.data || null);
  const [loading, setLoading] = useState(false);

  // Wijzigingen vanuit de agenda zelf (slepen, aanmaken) meteen tonen.
  useEffect(() => {
    const listener = () => {
      const hit = agendaCache.get(key);
      if (hit) setData(hit.data);
    };
    agendaListeners.add(listener);
    return () => {
      agendaListeners.delete(listener);
    };
  }, [key]);

  useEffect(() => {
    const hit = agendaCache.get(key);
    if (hit) setData(hit.data);
    if (hit && Date.now() - hit.at < 2 * 60 * 1000) return;
    let cancelled = false;
    const started = Date.now();
    // Net iets gewijzigd: Google niet uit de cache van de server halen.
    const fresh = started - lastAgendaEdit < 4 * 60 * 1000 ? "&fresh=1" : "";
    setLoading(true);
    api<AgendaData>(`/api/taken/agenda?from=${from}&to=${to}${fresh}`)
      .then((d) => {
        if (d.updatedTasks?.length) mergeTasks(d.updatedTasks);
        // Tijdens het ophalen iets versleept: die nieuwere stand niet overschrijven.
        if (lastAgendaEdit > started && agendaCache.has(key)) return;
        agendaCache.set(key, { at: Date.now(), from, to, data: d });
        if (!cancelled) setData(d);
      })
      .catch(() => !cancelled && setData((d) => d || { events: [], configured: false, errors: ["Agenda niet bereikbaar"] }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [key, from, to, mergeTasks]);

  return { data: data || agendaCache.get(key)?.data || null, loading };
}

/** Afspraken die (deels) op een lokale dag vallen. */
export function eventsOn(events: CalendarEvent[], date: string) {
  const start = new Date(`${date}T00:00:00`).getTime();
  const end = new Date(`${addDays(date, 1)}T00:00:00`).getTime();
  return events.filter((e) =>
    e.allDay ? (e.startDate as string) <= date && date < (e.endDate as string) : e.end > start && e.start < end
  );
}
