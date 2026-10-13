// Iets op een later tijdstip laten gebeuren via Upstash QStash (gratis tier): QStash roept dan
// /api/taken/cron aan met CRON_SECRET. Zonder QSTASH_TOKEN gebeurt er niets (alleen de dagelijkse cron).

const token = () => (process.env.QSTASH_TOKEN || "").trim();
const cronSecret = () => (process.env.CRON_SECRET || "").trim();
const QSTASH = (process.env.QSTASH_URL || "https://qstash.upstash.io").replace(/\/+$/, "");

/** Het openbare adres van de site, voor terugroepen door QStash. */
export function publicOrigin(): string | null {
  const explicit = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : null;
}

export const schedulingAvailable = () => Boolean(token() && cronSecret() && publicOrigin());

/** Plant een aanroep van /api/taken/cron met deze body op tijdstip `at` (ms). Geeft het QStash-bericht-id terug. */
export async function scheduleJob(at: number, body: object): Promise<string | null> {
  if (!schedulingAvailable()) return null;
  const res = await fetch(`${QSTASH}/v2/publish/${publicOrigin()}/api/taken/cron`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      "Upstash-Not-Before": String(Math.floor(at / 1000)),
      "Upstash-Forward-Authorization": `Bearer ${cronSecret()}`,
      "Upstash-Retries": "2",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("taken qstash", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json().catch(() => ({}));
  return data.messageId || null;
}
