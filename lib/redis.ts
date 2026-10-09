// Upstash Redis via de REST-API (Vercel Marketplace, gratis tier).
// Gedeeld door Ranking the Stars en de taken-app.

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasRedis = Boolean(redisUrl && redisToken);

export async function redis(command: string[]): Promise<unknown> {
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
