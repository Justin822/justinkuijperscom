"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addDays, localToday } from "@/lib/taken/dates";
import { applyDelta } from "@/lib/taken/delta";
import { newId, newNote, newTask } from "@/lib/taken/validate";
import { clearOffline, dequeue, enqueue, isOfflineError, loadSnapshot, QueuedError, queued, saveSnapshot } from "./offline";
import { WORKDAY } from "@/lib/taken/agenda";
import type { CalendarEvent, DayPlan, Note, PublicSettings, Task } from "@/lib/taken/types";
import { readLocal, writeLocal } from "./device";

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
  /** Met `debounce` (ms) worden snelle opeenvolgende wijzigingen (bijv. pijltjestoetsen) samen als één verzoek gestuurd. */
  updateTask: (id: string, patch: Partial<Task>, options?: { debounce?: number }) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  mergeTasks: (tasks: Task[]) => void;
  reload: () => Promise<void>;
  createNote: (input: Partial<Note>) => Promise<Note>;
  /** Met `base` (bodyHash van de tekst waarop je verder typte) weigert de server als de tekst elders is gewijzigd (ApiError 409). */
  updateNote: (id: string, patch: Partial<Note>, base?: string) => Promise<Note>;
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
  /** Verbinding en de offline-wachtrij: hoeveel wijzigingen nog wachten op verzenden. */
  sync: { online: boolean; pending: number };
};

// Drie contexten, zodat een onderdeel alleen opnieuw tekent als wat het gebruikt verandert:
// - data: taken, notities, instellingen, de dag (verandert bij elke wijziging aan je gegevens);
// - acties: functies die nooit veranderen (wijzigen, melden, openen);
// - ui: toast, geopende taak, focus-timer en zoekvenster.
type DataKey = "tasks" | "notes" | "loaded" | "error" | "today" | "plan" | "planAction" | "reloadPlan" | "settings" | "setSettings" | "workday" | "addRef";
type ActionKey =
  | "addTasks" | "updateTask" | "removeTask" | "mergeTasks" | "reload" | "createNote" | "updateNote" | "removeNote"
  | "openTask" | "notify" | "undoLast" | "changeTask" | "openPalette" | "setFocusOpen";
type DataCtx = Pick<Ctx, DataKey>;
type ActionsCtx = Pick<Ctx, ActionKey>;
type UiCtx = Omit<Ctx, DataKey | ActionKey>;

const DataContext = createContext<DataCtx | null>(null);
const ActionsContext = createContext<ActionsCtx | null>(null);
const UiContext = createContext<UiCtx | null>(null);
/** Alleen de datum van vandaag (verandert één keer per dag), voor lijstregels die verder niets nodig hebben. */
const TodayContext = createContext<string>("");

/** Fout van de API, met de statuscode en het antwoord (bijv. de nieuwe versie bij 409). */
export class ApiError extends Error {
  constructor(message: string, public status: number, public data: any) {
    super(message);
  }
}

// Luisteraars voor de offline-wachtrij (aantal wachtende wijzigingen in de balk).
const outboxListeners = new Set<() => void>();

/**
 * Verzoek naar de eigen API. Met `queue` gaat een wijziging bij geen verbinding in de offline-wachtrij
 * (QueuedError) in plaats van te mislukken; hij wordt verstuurd zodra er weer verbinding is.
 */
export async function api<T = any>(path: string, init?: RequestInit, options: { queue?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
  } catch (error) {
    const method = (init?.method || "GET").toUpperCase();
    if (options.queue && method !== "GET" && isOfflineError(error)) {
      await enqueue({ method, path, body: typeof init?.body === "string" ? init.body : undefined });
      outboxListeners.forEach((listener) => listener());
      throw new QueuedError();
    }
    throw error;
  }
  if (res.status === 401) {
    window.location.href = "/app/toegang";
    throw new Error("Log eerst in.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Er ging iets mis (${res.status}).`, res.status, data);
  return data;
}

const FOCUS_KEY = "tk-focus";
export const focusElapsed = (f: Focus, now = Date.now()) => f.elapsed + (f.runningSince ? now - f.runningSince : 0);

function readFocus(): Focus | null {
  try {
    const raw = readLocal(FOCUS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
// Zonder opslag (privévenster) werkt de timer, maar overleeft hij geen herlaadbeurt.
const writeFocus = (f: Focus | null) => writeLocal(FOCUS_KEY, f ? JSON.stringify(f) : null);

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

  // Lokale kopie (IndexedDB): de app opent direct met je laatste gegevens, ook zonder netwerk.
  const networkLoaded = useRef(false);
  const fromSnapshot = useRef(false);

  // Na de eerste keer alleen wijzigingen ophalen (delta-sync); elke 10 minuten toch weer alles.
  const lastSync = useRef<{ at: number; full: number } | null>(null);
  const reload = useCallback(async () => {
    try {
      const prev = lastSync.current;
      const delta = prev && Date.now() - prev.full < 10 * 60000 ? `?since=${prev.at - 2000}` : "";
      const [t, n, st] = await Promise.all([
        api<{ tasks: Task[]; ids?: string[]; now: number }>(`/api/taken/tasks${delta}`),
        api<{ notes: Note[]; ids?: string[]; now: number }>(`/api/taken/notes${delta}`),
        api<{ settings: PublicSettings }>("/api/taken/settings").catch(() => null),
      ]);
      // Wachten er nog offline wijzigingen, dan is de lijst in de browser nieuwer dan die op de server:
      // eerst versturen (flushOutbox laadt daarna opnieuw).
      if ((await queued()).length) return;
      setTasks((list) => applyDelta(list, { items: t.tasks, ids: t.ids, now: t.now }));
      setNotes((list) => applyDelta(list, { items: n.notes, ids: n.ids, now: n.now }));
      lastSync.current = { at: Math.min(t.now, n.now), full: delta && prev ? prev.full : Date.now() };
      if (st) setSettingsState(st.settings);
      setError(null);
      // Mail-radar: nieuwe gelabelde mails als taken ophalen (de server doet dit hooguit eens per 2 minuten).
      if (st?.settings.mail.enabled) {
        api<{ tasks: Task[] }>("/api/taken/mail", { method: "POST", body: "{}" })
          .then((m) => {
            if (!m.tasks.length) return;
            setTasks((list) => [...list.filter((x) => !m.tasks.some((y) => y.id === x.id)), ...m.tasks]);
            notify(m.tasks.length === 1 ? "1 taak uit je mail" : `${m.tasks.length} taken uit je mail`);
          })
          .catch(() => {});
      }
      networkLoaded.current = true;
    } catch (err: any) {
      // Offline met een lokale kopie: gewoon doorwerken, de balk laat zien dat je offline bent.
      if (!(isOfflineError(err) && fromSnapshot.current)) setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, [notify]);

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
    loadSnapshot<{ tasks: Task[]; notes: Note[]; settings: PublicSettings | null; plan: DayPlan | null }>("data").then((snap) => {
      if (!snap || networkLoaded.current) return;
      fromSnapshot.current = true;
      setTasks(snap.tasks);
      setNotes(snap.notes);
      if (snap.settings) setSettingsState(snap.settings);
      if (snap.plan?.date === localToday()) setPlan((p) => p || snap.plan);
      setLoaded(true);
    });
    reload();
    setFocus(readFocus());
  }, [reload]);

  // De kopie bijwerken zodra er iets verandert (even wachten, zodat snel typen niet steeds schrijft).
  useEffect(() => {
    if (!loaded || !networkLoaded.current) return;
    const timer = setTimeout(() => saveSnapshot("data", { tasks, notes, settings, plan }), 500);
    return () => clearTimeout(timer);
  }, [loaded, tasks, notes, settings, plan]);

  // ----- Offline-wachtrij -----
  const [sync, setSync] = useState({ online: true, pending: 0 });
  const countPending = useCallback(async () => {
    const pending = (await queued()).length;
    setSync({ online: typeof navigator === "undefined" ? true : navigator.onLine, pending });
  }, []);
  const flushing = useRef(false);
  /** Wachtende wijzigingen versturen, op volgorde. Stopt bij geen verbinding; daarna opnieuw laden. */
  const flushOutbox = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    let sent = 0;
    try {
      for (const item of await queued()) {
        let res: Response;
        try {
          res = await fetch(item.path, { method: item.method, headers: { "Content-Type": "application/json" }, body: item.body, cache: "no-store" });
        } catch {
          break; // nog steeds offline
        }
        if (res.status === 401 || res.status >= 500) break; // eerst inloggen, of de server later nog eens
        if (res.status === 409 && item.path.startsWith("/api/taken/notes/") && item.body) {
          // Notitie intussen elders gewijzigd: jouw offline versie wordt een kopie, niets gaat verloren.
          const body = JSON.parse(item.body).body as string | undefined;
          if (body) {
            const [first, ...rest] = body.split("\n");
            await fetch("/api/taken/notes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ body: [`${first || "Notitie"} (jouw versie)`, ...rest].join("\n") }),
            }).catch(() => {});
          }
        }
        await dequeue(item.id as number);
        sent++;
      }
    } finally {
      flushing.current = false;
      await countPending();
    }
    if (sent) {
      lastSync.current = null; // alles opnieuw, zodat de app precies de stand van de server toont
      await reload();
    }
  }, [countPending, reload]);

  useEffect(() => {
    const changed = () => {
      countPending();
      if (navigator.onLine) flushOutbox();
    };
    outboxListeners.add(countPending);
    window.addEventListener("online", changed);
    window.addEventListener("offline", changed);
    changed();
    // Server even onbereikbaar terwijl de browser denkt dat hij online is: af en toe opnieuw proberen.
    const timer = setInterval(() => sync.pending && navigator.onLine && flushOutbox(), 30000);
    return () => {
      outboxListeners.delete(countPending);
      window.removeEventListener("online", changed);
      window.removeEventListener("offline", changed);
      clearInterval(timer);
    };
  }, [countPending, flushOutbox, sync.pending]);

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
      // Het id maakt de browser zelf: dan is een taak die offline is gemaakt later dezelfde taak op de server.
      const withIds = inputs.map((input) => ({ ...input, id: input.id || newId() }));
      try {
        const data = await api<{ tasks: Task[]; sync?: string }>(
          "/api/taken/tasks",
          { method: "POST", body: JSON.stringify({ tasks: withIds }) },
          { queue: true }
        );
        mergeTasks(data.tasks);
        if (data.sync === "fout") notify("Opgeslagen, maar niet in Google Agenda gezet");
        return data.tasks;
      } catch (err) {
        if (!(err instanceof QueuedError)) throw err;
        const local = withIds.map((input) => newTask(input)).filter(Boolean) as Task[];
        mergeTasks(local);
        return local;
      }
    },
    [mergeTasks, notify]
  );

  // Per taak: het volgnummer van de laatste wijziging (een later antwoord op een oudere wijziging
  // mag het scherm niet terugzetten) en wijzigingen die nog even wachten (debounce).
  const taskSeq = useRef(new Map<string, number>());
  const waiting = useRef(new Map<string, { patch: Partial<Task>; before: Task; timer: ReturnType<typeof setTimeout>; done: (() => void)[] }>());

  const sendTaskPatch = useCallback(
    async (id: string, patch: Partial<Task>, before: Task) => {
      const seq = (taskSeq.current.get(id) || 0) + 1;
      taskSeq.current.set(id, seq);
      const latest = () => taskSeq.current.get(id) === seq;
      try {
        const data = await api<{ task: Task; created?: Task[]; removed?: string[]; sync?: string }>(
          `/api/taken/tasks/${id}`,
          { method: "PATCH", body: JSON.stringify({ ...patch, today: localToday() }) },
          { queue: true }
        );
        mergeTasks([...(latest() ? [data.task] : []), ...(data.created || [])]);
        // Weer opengezette herhaling: de volgende keer die het afvinken had gemaakt is weg.
        if (data.removed?.length) setTasks((list) => list.filter((t) => !data.removed!.includes(t.id)));
        if (data.sync === "fout") notify("Opgeslagen, maar niet in Google Agenda gezet");
      } catch (err: any) {
        if (err instanceof QueuedError) return; // offline: de wijziging blijft staan en gaat later mee
        if (latest()) mergeTasks([before]);
        notify(err.message);
      }
    },
    [mergeTasks, notify]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>, options: { debounce?: number } = {}) => {
      const current = tasksRef.current.find((t) => t.id === id);
      if (!current) return;
      const optimistic: Task = { ...current, ...patch, updatedAt: Date.now() };
      if (patch.status === "af" && current.status !== "af") optimistic.doneAt = Date.now();
      mergeTasks([optimistic]);

      const pending = waiting.current.get(id);
      if (pending) clearTimeout(pending.timer);
      const combined = { ...(pending?.patch || {}), ...patch };
      const before = pending?.before || current;
      if (!options.debounce) {
        waiting.current.delete(id);
        await sendTaskPatch(id, combined, before);
        pending?.done.forEach((resolve) => resolve());
        return;
      }
      await new Promise<void>((resolve) => {
        const done = [...(pending?.done || []), resolve];
        const timer = setTimeout(async () => {
          waiting.current.delete(id);
          await sendTaskPatch(id, combined, before);
          done.forEach((r) => r());
        }, options.debounce);
        waiting.current.set(id, { patch: combined, before, timer, done });
      });
    },
    [mergeTasks, sendTaskPatch]
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
        await api(`/api/taken/tasks/${id}`, { method: "DELETE" }, { queue: true });
      } catch (err: any) {
        if (err instanceof QueuedError) return;
        if (before) mergeTasks([before]);
        notify(err.message);
      }
    },
    [mergeTasks, notify]
  );

  const createNote = useCallback(async (input: Partial<Note>) => {
    const withId = { ...input, id: input.id || newId() };
    try {
      const data = await api<{ note: Note }>("/api/taken/notes", { method: "POST", body: JSON.stringify(withId) }, { queue: true });
      setNotes((list) => [data.note, ...list.filter((n) => n.id !== data.note.id)]);
      return data.note;
    } catch (err) {
      if (!(err instanceof QueuedError)) throw err;
      const local = newNote(withId);
      setNotes((list) => [local, ...list]);
      return local;
    }
  }, []);

  const updateNote = useCallback(
    async (id: string, patch: Partial<Note>, base?: string) => {
      setNotes((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)));
      try {
        const data = await api<{ note: Note }>(
          `/api/taken/notes/${id}`,
          { method: "PATCH", body: JSON.stringify(base === undefined ? patch : { ...patch, base }) },
          { queue: true }
        );
        // Alleen metadata overnemen; de tekst in de editor kan intussen verder zijn.
        setNotes((list) => list.map((n) => (n.id === id ? { ...n, updatedAt: data.note.updatedAt } : n)));
        return data.note;
      } catch (err: any) {
        // Offline: lokaal bewaard, gaat later mee (een botsing wordt dan een kopie, zie flushOutbox).
        if (err instanceof QueuedError) return notesRef.current.find((n) => n.id === id) as Note;
        if (err instanceof ApiError && err.status === 409 && err.data?.note) {
          const fresh = err.data.note as Note;
          setNotes((list) => list.map((n) => (n.id === id ? fresh : n)));
        } else notify(err.message);
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
        await api(`/api/taken/notes/${id}`, { method: "DELETE" }, { queue: true });
      } catch (err: any) {
        if (err instanceof QueuedError) return;
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
  // Met pushmeldingen (en QStash) plant de server een melding voor het einde, ook als de app dan dicht is.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const syncFocusPush = useCallback((f: Focus | null) => {
    const push = settingsRef.current?.push;
    if (!push?.configured || !push.scheduled || !push.focus || !push.devices) return;
    if (f?.runningSince) {
      const endsAt = f.runningSince + f.minutes * 60000 - f.elapsed;
      const title = tasksRef.current.find((t) => t.id === f.taskId)?.title || "je taak";
      api("/api/taken/push/focus", { method: "POST", body: JSON.stringify({ endsAt, minutes: f.minutes, title }) }).catch(() => {});
    } else {
      api("/api/taken/push/focus", { method: "DELETE" }).catch(() => {});
    }
  }, []);
  const saveFocus = useCallback(
    (f: Focus | null) => {
      setFocus(f);
      writeFocus(f);
      syncFocusPush(f);
    },
    [syncFocusPush]
  );

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

  const data = useMemo<DataCtx>(
    () => ({
      tasks,
      notes,
      loaded,
      error,
      today,
      plan,
      planAction,
      reloadPlan,
      settings,
      setSettings,
      workday: settings?.workday || WORKDAY,
      addRef,
    }),
    [
      tasks,
      notes,
      loaded,
      error,
      today,
      plan,
      planAction,
      reloadPlan,
      settings,
      setSettings,
      addRef,
    ]
  );
  const actions = useMemo<ActionsCtx>(
    () => ({
      addTasks,
      updateTask,
      removeTask,
      mergeTasks,
      reload,
      createNote,
      updateNote,
      removeNote,
      openTask: setEditing,
      notify,
      undoLast,
      changeTask,
      openPalette,
      setFocusOpen,
    }),
    [
      addTasks,
      updateTask,
      removeTask,
      mergeTasks,
      reload,
      createNote,
      updateNote,
      removeNote,
      setEditing,
      notify,
      undoLast,
      changeTask,
      openPalette,
      setFocusOpen,
    ]
  );
  const ui = useMemo<UiCtx>(
    () => ({
      editing,
      toast,
      focus,
      startFocus,
      pauseFocus,
      resumeFocus,
      stopFocus,
      focusOpen,
      palette,
      sync,
    }),
    [
      sync,
      editing,
      toast,
      focus,
      startFocus,
      pauseFocus,
      resumeFocus,
      stopFocus,
      focusOpen,
      palette,
    ]
  );

  return (
    <ActionsContext.Provider value={actions}>
      <DataContext.Provider value={data}>
        <UiContext.Provider value={ui}>
          <TodayContext.Provider value={today}>{mounted ? children : null}</TodayContext.Provider>
        </UiContext.Provider>
      </DataContext.Provider>
    </ActionsContext.Provider>
  );
}

function need<T>(value: T | null, name: string): T {
  if (!value) throw new Error(`${name} buiten TakenProvider`);
  return value;
}

/** Taken, notities, instellingen en de dag. */
export const useTakenData = () => need(useContext(DataContext), "useTakenData");
/** Functies die nooit veranderen: een onderdeel dat alleen deze gebruikt, tekent niet opnieuw bij wijzigingen. */
export const useTakenActions = () => need(useContext(ActionsContext), "useTakenActions");
/** Toast, geopende taak, focus-timer en zoekvenster. */
export const useTakenUi = () => need(useContext(UiContext), "useTakenUi");
/** De datum van vandaag (YYYY-MM-DD). */
export const useToday = () => useContext(TodayContext);

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
  const { settings } = useTakenData();
  const { mergeTasks } = useTakenActions();
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
