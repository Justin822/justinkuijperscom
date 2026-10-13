// Upstash Redis via de REST-API (Vercel Marketplace, gratis tier).
// Gedeeld door Ranking the Stars en de taken-app.

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasRedis = Boolean(redisUrl && redisToken);

const TIMEOUT = 8000;

async function call(command: string[]): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(redisUrl as string, {
      method: "POST",
      headers: { Authorization: `Bearer ${redisToken}` },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await res.text();
    let json: { result?: unknown; error?: string } = {};
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Redis: onverwacht antwoord (${res.status})`);
    }
    if (!res.ok || json.error) throw new Error(`Redis: ${json.error || res.status}`);
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

// Alleen commando's die je veilig twee keer kunt sturen; INCR, HINCRBY en scripts niet (dan telt iets dubbel).
const IDEMPOTENT = new Set(["GET", "MGET", "HGET", "HGETALL", "HMGET", "SET", "HSET", "HDEL", "DEL", "EXPIRE"]);

/** Eén Redis-commando. Lezen en overschrijven wordt bij een netwerkfout of time-out één keer opnieuw geprobeerd. */
export async function redis(command: string[]): Promise<unknown> {
  try {
    return await call(command);
  } catch (error: any) {
    const network = error?.name === "AbortError" || error?.name === "TypeError" || /fetch failed|ECONNRESET|ETIMEDOUT/i.test(error?.message || "");
    if (!network || !IDEMPOTENT.has(command[0].toUpperCase())) throw error;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return call(command);
  }
}

/** Een Lua-script atomair uitvoeren (EVAL). */
export function evalScript(script: string, keys: string[], args: string[]): Promise<unknown> {
  return redis(["EVAL", script, String(keys.length), ...keys, ...args]);
}
