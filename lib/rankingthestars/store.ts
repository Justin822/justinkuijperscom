import { promises as fs } from "fs";
import os from "os";
import path from "path";

// Opslag voor Ranking the Stars.
// Met Upstash Redis (Vercel Marketplace) als de env-variabelen gezet zijn,
// anders een JSON-bestand (prima lokaal, niet persistent op Vercel).

export type StoredSubmission = {
  playerId: string;
  rankings: Record<string, string[]>;
  stories: Record<string, string>;
  tokenHash: string;
  updatedAt: number;
};

export type GameState = {
  votingOpen: boolean;
};

const SUBS_KEY = "rts:subs";
const STATE_KEY = "rts:state";
const DEFAULT_STATE: GameState = { votingOpen: true };

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const storageKind: "redis" | "file" = redisUrl && redisToken ? "redis" : "file";

async function redis(command: string[]): Promise<unknown> {
  const res = await fetch(redisUrl as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}` },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Redis: ${json.error || res.status}`);
  }
  return json.result;
}

type FileData = { state: GameState; subs: Record<string, StoredSubmission> };

const dataFile =
  process.env.RTS_DATA_FILE ||
  (process.env.VERCEL
    ? path.join(os.tmpdir(), "rts-data.json")
    : path.join(process.cwd(), ".rts-data.json"));

async function readFile(): Promise<FileData> {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const data = JSON.parse(raw);
    return { state: { ...DEFAULT_STATE, ...data.state }, subs: data.subs || {} };
  } catch {
    return { state: DEFAULT_STATE, subs: {} };
  }
}

async function writeFile(data: FileData) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}

export async function getState(): Promise<GameState> {
  if (storageKind === "file") return (await readFile()).state;
  const raw = (await redis(["GET", STATE_KEY])) as string | null;
  return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
}

export async function setState(state: GameState) {
  if (storageKind === "file") {
    const data = await readFile();
    await writeFile({ ...data, state });
    return;
  }
  await redis(["SET", STATE_KEY, JSON.stringify(state)]);
}

export async function getSubmissions(): Promise<StoredSubmission[]> {
  if (storageKind === "file") return Object.values((await readFile()).subs);
  const flat = ((await redis(["HGETALL", SUBS_KEY])) as string[] | null) || [];
  const subs: StoredSubmission[] = [];
  for (let i = 1; i < flat.length; i += 2) {
    try {
      subs.push(JSON.parse(flat[i]));
    } catch {
      // kapotte regel overslaan
    }
  }
  return subs;
}

export async function getSubmission(playerId: string): Promise<StoredSubmission | null> {
  if (storageKind === "file") return (await readFile()).subs[playerId] || null;
  const raw = (await redis(["HGET", SUBS_KEY, playerId])) as string | null;
  return raw ? JSON.parse(raw) : null;
}

export async function saveSubmission(sub: StoredSubmission) {
  if (storageKind === "file") {
    const data = await readFile();
    data.subs[sub.playerId] = sub;
    await writeFile(data);
    return;
  }
  await redis(["HSET", SUBS_KEY, sub.playerId, JSON.stringify(sub)]);
}

export async function deleteSubmission(playerId: string) {
  if (storageKind === "file") {
    const data = await readFile();
    delete data.subs[playerId];
    await writeFile(data);
    return;
  }
  await redis(["HDEL", SUBS_KEY, playerId]);
}
