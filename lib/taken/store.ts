import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { hasRedis, redis } from "@/lib/redis";
import type { DayPlan, Task } from "./types";

// Opslag voor de taken-app: Upstash Redis als die gekoppeld is,
// anders een JSON-bestand (prima lokaal, niet persistent op Vercel).

const TASKS_KEY = "taken:tasks";
const dayKey = (date: string) => `taken:day:${date}`;

export const storageKind: "redis" | "file" = hasRedis ? "redis" : "file";

type FileData = { tasks: Record<string, Task>; days: Record<string, DayPlan> };

const dataFile =
  process.env.TAKEN_DATA_FILE ||
  (process.env.VERCEL ? path.join(os.tmpdir(), "taken-data.json") : path.join(process.cwd(), ".taken-data.json"));

async function readFile(): Promise<FileData> {
  try {
    const data = JSON.parse(await fs.readFile(dataFile, "utf8"));
    return { tasks: data.tasks || {}, days: data.days || {} };
  } catch {
    return { tasks: {}, days: {} };
  }
}

async function writeFile(data: FileData) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
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
  if (storageKind === "file") return Object.values((await readFile()).tasks);
  const flat = ((await redis(["HGETALL", TASKS_KEY])) as string[] | null) || [];
  const tasks: Task[] = [];
  for (let i = 1; i < flat.length; i += 2) {
    const task = parse<Task>(flat[i]);
    if (task) tasks.push(task);
  }
  return tasks;
}

export async function getTask(id: string): Promise<Task | null> {
  if (storageKind === "file") return (await readFile()).tasks[id] || null;
  return parse<Task>((await redis(["HGET", TASKS_KEY, id])) as string | null);
}

export async function saveTasks(tasks: Task[]) {
  if (!tasks.length) return;
  if (storageKind === "file") {
    const data = await readFile();
    for (const task of tasks) data.tasks[task.id] = task;
    await writeFile(data);
    return;
  }
  await redis(["HSET", TASKS_KEY, ...tasks.flatMap((t) => [t.id, JSON.stringify(t)])]);
}

export async function deleteTask(id: string) {
  if (storageKind === "file") {
    const data = await readFile();
    delete data.tasks[id];
    await writeFile(data);
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
    const data = await readFile();
    data.days[plan.date] = plan;
    await writeFile(data);
    return;
  }
  // Een dagplan is alleen een paar dagen nodig (voor de balans tussen gebieden).
  await redis(["SET", dayKey(plan.date), JSON.stringify(plan), "EX", String(60 * 60 * 24 * 60)]);
}
