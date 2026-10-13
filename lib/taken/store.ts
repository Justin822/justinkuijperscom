import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { hasRedis, redis } from "@/lib/redis";
import { WORKDAY } from "./agenda";
import { seal, unseal } from "./secrets";
import type { DayPlan, Note, Settings, Task } from "./types";
import { normalizeTask } from "./validate";

// Opslag voor de taken-app: Upstash Redis als die gekoppeld is,
// anders een JSON-bestand (prima lokaal, niet persistent op Vercel).

const TASKS_KEY = "taken:tasks";
const NOTES_KEY = "taken:notes";
const SETTINGS_KEY = "taken:settings";

export const DEFAULT_SETTINGS: Settings = {
  icsSources: [],
  workday: WORKDAY,
  google: null,
};
const dayKey = (date: string) => `taken:day:${date}`;
const focusKey = (date: string) => `taken:focus:${date}`;
const SESSIONS_KEY = "taken:sessions";
const loginFailKey = (who: string) => `taken:login-fail:${who}`;

/** Een ingelogd apparaat. */
export type Session = { id: string; createdAt: number; lastSeenAt: number; device: string };

/** Focusminuten van één dag per gebied ("geen" = zonder gebied). */
export type FocusLog = Record<string, number>;
export const NO_AREA = "geen";

export const storageKind: "redis" | "file" = hasRedis ? "redis" : "file";

type FileData = {
  tasks: Record<string, Task>;
  days: Record<string, DayPlan>;
  notes: Record<string, Note>;
  focus?: Record<string, FocusLog>;
  sessions?: Record<string, Session>;
  settings?: Settings;
};

const dataFile =
  process.env.TAKEN_DATA_FILE ||
  (process.env.VERCEL ? path.join(os.tmpdir(), "taken-data.json") : path.join(process.cwd(), ".taken-data.json"));

async function readFile(): Promise<FileData> {
  try {
    const data = JSON.parse(await fs.readFile(dataFile, "utf8"));
    return { tasks: data.tasks || {}, days: data.days || {}, notes: data.notes || {}, focus: data.focus || {}, sessions: data.sessions || {}, settings: data.settings };
  } catch {
    return { tasks: {}, days: {}, notes: {} };
  }
}

// Eerst naar een tijdelijk bestand en dan hernoemen (atomair): een verzoek dat tegelijk leest,
// ziet zo altijd het hele oude of het hele nieuwe bestand, nooit een half geschreven versie.
async function writeFile(data: FileData) {
  const tmp = `${dataFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, dataFile);
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
  // Dagplannen blijven bewaard, zodat de weekreview ook voor oudere weken klopt.
  await redis(["SET", dayKey(plan.date), JSON.stringify(plan)]);
}

/** Gewerkte focusminuten bijschrijven op een dag (atomair, ook bij gelijktijdige verzoeken). */
export async function addFocus(date: string, area: string, minutes: number) {
  if (minutes <= 0) return;
  if (storageKind === "file") {
    await editFile((data) => {
      const day = ((data.focus ||= {})[date] ||= {});
      day[area] = (day[area] || 0) + minutes;
    });
    return;
  }
  await redis(["HINCRBY", focusKey(date), area, String(Math.round(minutes))]);
}

export async function getFocus(dates: string[]): Promise<FocusLog[]> {
  if (storageKind === "file") {
    const data = await readFile();
    return dates.map((d) => data.focus?.[d] || {});
  }
  return Promise.all(
    dates.map(async (d) => {
      const flat = ((await redis(["HGETALL", focusKey(d)])) as string[] | null) || [];
      const log: FocusLog = {};
      for (let i = 0; i < flat.length; i += 2) log[flat[i]] = Number(flat[i + 1]) || 0;
      return log;
    })
  );
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

// Het Google-token staat versleuteld in de opslag (als TAKEN_SECRET is ingesteld).
function openSettings(stored: Settings | null | undefined): Settings {
  const settings = { ...DEFAULT_SETTINGS, ...(stored || {}) };
  if (!settings.google) return settings;
  const token = unseal(settings.google.refreshToken);
  // Niet te ontsleutelen (TAKEN_SECRET veranderd of weg): opnieuw koppelen.
  return { ...settings, google: token === null ? { ...settings.google, refreshToken: "", needsReconnect: true } : { ...settings.google, refreshToken: token } };
}

function sealSettings(settings: Settings): Settings {
  if (!settings.google?.refreshToken) return settings;
  return { ...settings, google: { ...settings.google, refreshToken: seal(settings.google.refreshToken) } };
}

export async function getSettings(): Promise<Settings> {
  const stored =
    storageKind === "file"
      ? (await readFile()).settings
      : parse<Settings>((await redis(["GET", SETTINGS_KEY])) as string | null);
  return openSettings(stored);
}

export async function saveSettings(settings: Settings) {
  const sealed = sealSettings(settings);
  if (storageKind === "file") {
    await editFile((data) => {
      data.settings = sealed;
    });
    return;
  }
  await redis(["SET", SETTINGS_KEY, JSON.stringify(sealed)]);
}

/** Instellingen bijwerken op basis van de laatste stand (voorkomt dat twee wijzigingen elkaar overschrijven). */
export async function updateSettings(change: (s: Settings) => Settings): Promise<Settings> {
  if (storageKind === "file") {
    return editFile((data) => {
      const next = change(openSettings(data.settings));
      data.settings = sealSettings(next);
      return next;
    });
  }
  const next = change(await getSettings());
  await saveSettings(next);
  return next;
}

export async function getSession(id: string): Promise<Session | null> {
  if (storageKind === "file") return (await readFile()).sessions?.[id] || null;
  return parse<Session>((await redis(["HGET", SESSIONS_KEY, id])) as string | null);
}

export async function getSessions(): Promise<Session[]> {
  if (storageKind === "file") return Object.values((await readFile()).sessions || {});
  return hashValues<Session>(SESSIONS_KEY);
}

export async function saveSession(session: Session) {
  if (storageKind === "file") {
    await editFile((data) => {
      (data.sessions ||= {})[session.id] = session;
    });
    return;
  }
  await redis(["HSET", SESSIONS_KEY, session.id, JSON.stringify(session)]);
}

export async function deleteSessions(ids: string[]) {
  if (!ids.length) return;
  if (storageKind === "file") {
    await editFile((data) => {
      for (const id of ids) delete data.sessions?.[id];
    });
    return;
  }
  await redis(["HDEL", SESSIONS_KEY, ...ids]);
}

// Mislukte inlogpogingen per IP-adres, om raden af te remmen. Zonder Redis alleen in het geheugen.
const memoryFails = new Map<string, { count: number; until: number }>();
export const LOGIN_WINDOW = 15 * 60;

export async function loginFailures(who: string): Promise<number> {
  if (storageKind === "file") {
    const entry = memoryFails.get(who);
    return entry && entry.until > Date.now() ? entry.count : 0;
  }
  return Number(await redis(["GET", loginFailKey(who)])) || 0;
}

export async function addLoginFailure(who: string) {
  if (storageKind === "file") {
    const entry = memoryFails.get(who);
    const fresh = !entry || entry.until <= Date.now();
    memoryFails.set(who, { count: fresh ? 1 : entry!.count + 1, until: fresh ? Date.now() + LOGIN_WINDOW * 1000 : entry!.until });
    return;
  }
  const count = Number(await redis(["INCR", loginFailKey(who)]));
  if (count === 1) await redis(["EXPIRE", loginFailKey(who), String(LOGIN_WINDOW)]);
}

export async function clearLoginFailures(who: string) {
  if (storageKind === "file") memoryFails.delete(who);
  else await redis(["DEL", loginFailKey(who)]);
}
