"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { localToday } from "@/lib/taken/dates";
import type { DayPlan, Task } from "@/lib/taken/types";

// Alle taken staan in de browser in één lijst; wijzigingen zijn direct zichtbaar
// en gaan op de achtergrond naar de server (bij een fout terug naar de oude stand).

type Toast = { id: number; text: string; undo?: () => void };

type Ctx = {
  tasks: Task[];
  loaded: boolean;
  error: string | null;
  today: string;
  addTasks: (inputs: Partial<Task>[]) => Promise<Task[]>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  mergeTasks: (tasks: Task[]) => void;
  reload: () => Promise<void>;
  editing: string | null;
  openTask: (id: string | null) => void;
  toast: Toast | null;
  notify: (text: string, undo?: () => void) => void;
  addRef: React.MutableRefObject<HTMLInputElement | null>;
  plan: DayPlan | null;
  planAction: (action: "swap" | "promote" | "recompute", id?: string) => Promise<void>;
  reloadPlan: () => Promise<void>;
};

const TakenContext = createContext<Ctx | null>(null);

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (res.status === 401) {
    window.location.href = "/taken/toegang";
    throw new Error("Log eerst in.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Er ging iets mis (${res.status}).`);
  return data;
}

export function TakenProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(localToday);
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const addRef = useRef<HTMLInputElement | null>(null);
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;

  const notify = useCallback((text: string, undo?: () => void) => {
    const id = Date.now();
    setToast({ id, text, undo });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), undo ? 5000 : 3000);
  }, []);

  const reload = useCallback(async () => {
    try {
      const data = await api<{ tasks: Task[] }>("/api/taken/tasks");
      setTasks(data.tasks);
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
    reload();
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
      const data = await api<{ tasks: Task[] }>("/api/taken/tasks", {
        method: "POST",
        body: JSON.stringify({ tasks: inputs }),
      });
      mergeTasks(data.tasks);
      return data.tasks;
    },
    [mergeTasks]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      const before = tasksRef.current.find((t) => t.id === id);
      if (!before) return;
      const optimistic: Task = { ...before, ...patch, updatedAt: Date.now() };
      if (patch.status === "af" && before.status !== "af") optimistic.doneAt = Date.now();
      mergeTasks([optimistic]);
      try {
        const data = await api<{ task: Task }>(`/api/taken/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        mergeTasks([data.task]);
      } catch (err: any) {
        mergeTasks([before]);
        notify(err.message);
      }
    },
    [mergeTasks, notify]
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

  const value = useMemo<Ctx>(
    () => ({
      tasks,
      loaded,
      error,
      today,
      addTasks,
      updateTask,
      removeTask,
      mergeTasks,
      reload,
      editing,
      openTask: setEditing,
      toast,
      notify,
      addRef,
      plan,
      planAction,
      reloadPlan,
    }),
    [tasks, loaded, error, today, addTasks, updateTask, removeTask, mergeTasks, reload, editing, toast, notify, plan, planAction, reloadPlan]
  );

  return <TakenContext.Provider value={value}>{children}</TakenContext.Provider>;
}

export function useTaken() {
  const ctx = useContext(TakenContext);
  if (!ctx) throw new Error("useTaken buiten TakenProvider");
  return ctx;
}
