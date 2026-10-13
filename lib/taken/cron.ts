import { safeEqual } from "./access";

// Geplande taken (Vercel Cron of een externe planner zoals Upstash QStash) melden zich met
// "Authorization: Bearer <CRON_SECRET>". Vercel Cron stuurt die header vanzelf als CRON_SECRET is ingesteld.
export function isCronRequest(request: Request): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const given = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  return safeEqual(given, secret);
}
