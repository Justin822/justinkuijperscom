import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { hasRedis, redis } from "@/lib/redis";
import type { DayPlan, Note, Settings, Task } from "./types";
import { normalizeTask } from "./validate";

// Opslag voor de taken-app: Upstash Redis als die gekoppeld is,
// anders een JSON-bestand (prima lokaal, niet persistent op Vercel).

const TASKS_KEY = "taken:tasks";
const NOTES_KEY = "taken:notes";
const SETTINGS_KEY = "taken:settings";

export const DEFAULT_SETTINGS: Settings = {
  icsSources: [],
  workday: { start: "09:00", end: "17:30" },
  google: null,
};
const dayKey = (date: string) => `taken:day:${date}`;

export const storageKind: "redis" | "file" = hasRedis ? "redis" : "file";

type FileData = {
  tasks: Record<string, Task>;
  days: Record<string, DayPlan>;
  notes: Record<string, Note>;
  settings?: Settings;
};

const dataFile =
  process.env.TAKEN_DATA_FILE ||
  (process.env.VERCEL ? path.join(os.tmpdir(), "taken-data.json") : path.join(process.cwd(), ".taken-data.json"));

async function readFile(): Promise<FileData> {
  try {
    const data = JSON.parse(await fs.readFile(dataFile, "utf8"));
    return { tasks: data.tasks || {}, days: data.days || {}, notes: data.notes || {}, settings: data.settings };
  } catch {
    return { tasks: {}, days: {}, notes: {} };
  }
}

async function writeFile(data: FileData) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}

// Wijzigingen in het bestand één voor één, zodat twee gelijktijdige verzoeken elkaars werk niet overschrijven.
let fileQueue: Promise<unknown> = Promise.resolve();
function editFile<T>(change: (data: FileData) => T): Promise<T> {
  const run = fileQueue.then(async () => {
    const data = await readFile();
    const result = change(data);
    await writeFile(data);
    return result;
  });
  fileQueue = run.catch(() => {});
  return run;
}

const parse = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export async function getTasks(): Promise<Task[]> {
  if (storageKind === "file") return Object.values((await readFile()).tasks).map(normalizeTask);
  return (await hashValues<Task>(TASKS_KEY)).map(normalizeTask);
}

async function hashValues<T>(key: string): Promise<T[]> {
  const flat = ((await redis(["HGETALL", key])) as string[] | null) || [];
  const values: T[] = [];
  for (let i = 1; i < flat.length; i += 2) {
    const value = parse<T>(flat[i]);
    if (value) values.push(value);
  }
  return values;
}

export async function getTask(id: string): Promise<Task | null> {
  const task =
    storageKind === "file"
      ? (await readFile()).tasks[id] || null
      : parse<Task>((await redis(["HGET", TASKS_KEY, id])) as string | null);
  return task ? normalizeTask(task) : null;
}

export async function saveTasks(tasks: Task[]) {
  if (!tasks.length) return;
  if (storageKind === "file") {
    await editFile((data) => {
      for (const task of tasks) data.tasks[task.id] = task;
    });
    return;
  }
  await redis(["HSET", TASKS_KEY, ...tasks.flatMap((t) => [t.id, JSON.stringify(t)])]);
}

export async function deleteTask(id: string) {
  if (storageKind === "file") {
    await editFile((data) => {
      delete data.tasks[id];
    });
    return;
  }
  await redis(["HDEL", TASKS_KEY, id]);
}

export async function getDays(dates: string[]): Promise<(DayPlan | null)[]> {
  if (!dates.length) return [];
  if (storageKind === "file") {
    const data = await readFile();
    return dates.map((d) => data.days[d] || null);
  }
  const raw = ((await redis(["MGET", ...dates.map(dayKey)])) as (string | null)[]) || [];
  return dates.map((_, i) => parse<DayPlan>(raw[i] ?? null));
}

export async function getDay(date: string): Promise<DayPlan | null> {
  return (await getDays([date]))[0];
}

export async function saveDay(plan: DayPlan) {
  if (storageKind === "file") {
    await editFile((data) => {
      data.days[plan.date] = plan;
    });
    return;
  }
  // Een dagplan is alleen een paar dagen nodig (voor de balans tussen gebieden).
  await redis(["SET", dayKey(plan.date), JSON.stringify(plan), "EX", String(60 * 60 * 24 * 60)]);
}

export async function getNotes(): Promise<Note[]> {
  if (storageKind === "file") return Object.values((await readFile()).notes);
  return hashValues<Note>(NOTES_KEY);
}

export async function getNote(id: string): Promise<Note | null> {
  if (storageKind === "file") return (await readFile()).notes[id] || null;
  return parse<Note>((await redis(["HGET", NOTES_KEY, id])) as string | null);
}

export async function saveNote(note: Note) {
  if (storageKind === "file") {
    await editFile((data) => {
      data.notes[note.id] = note;
    });
    return;
  }
  await redis(["HSET", NOTES_KEY, note.id, JSON.stringify(note)]);
}

export async function deleteNote(id: string) {
  if (storageKind === "file") {
    await editFile((data) => {
      delete data.notes[id];
    });
    return;
  }
  await redis(["HDEL", NOTES_KEY, id]);
}

export async function getSettings(): Promise<Settings> {
  const stored =
    storageKind === "file"
      ? (await readFile()).settings
      : parse<Settings>((await redis(["GET", SETTINGS_KEY])) as string | null);
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

export async function saveSettings(settings: Settings) {
  if (storageKind === "file") {
    await editFile((data) => {
      data.settings = settings;
    });
    return;
  }
  await redis(["SET", SETTINGS_KEY, JSON.stringify(settings)]);
}

/** Instellingen bijwerken op basis van de laatste stand (voorkomt dat twee wijzigingen elkaar overschrijven). */
export async function updateSettings(change: (s: Settings) => Settings): Promise<Settings> {
  if (storageKind === "file") {
    return editFile((data) => {
      const next = change({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
      data.settings = next;
      return next;
    });
  }
  const next = change(await getSettings());
  await saveSettings(next);
  return next;
}
