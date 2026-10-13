import { createHash } from "crypto";
import webpush from "web-push";
import type { PushMessage } from "./push-messages";
import { deletePushSubscriptions, getPushSubscriptions, type PushSubscriptionRecord } from "./store";

// Web Push met VAPID-sleutels (zie README). Werkt op Android-Chrome, ook als de app dicht is.

const publicKey = () => (process.env.VAPID_PUBLIC_KEY || "").trim();
const privateKey = () => (process.env.VAPID_PRIVATE_KEY || "").trim();
const subject = () => (process.env.VAPID_SUBJECT || "mailto:planner@justinkuijpers.com").trim();

export const pushConfigured = () => Boolean(publicKey() && privateKey());
export const pushPublicKey = () => publicKey() || null;

export const subscriptionId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 24);

/** Alleen echte push-diensten (https), zodat de server niet naar willekeurige adressen gaat. */
export function validSubscription(input: any): Omit<PushSubscriptionRecord, "id" | "device" | "createdAt"> | null {
  const endpoint = typeof input?.endpoint === "string" ? input.endpoint : "";
  const p256dh = input?.keys?.p256dh;
  const auth = input?.keys?.auth;
  if (!/^https:\/\/[^\s]+$/.test(endpoint) || endpoint.length > 2000) return null;
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint, keys: { p256dh, auth } };
}

/** Stuurt een melding naar alle apparaten; verlopen abonnementen (404/410) worden opgeruimd. */
export async function sendPush(message: PushMessage, only?: string[]): Promise<{ sent: number; failed: number }> {
  if (!pushConfigured()) return { sent: 0, failed: 0 };
  webpush.setVapidDetails(subject(), publicKey(), privateKey());
  const subs = (await getPushSubscriptions()).filter((s) => !only || only.includes(s.id));
  const gone: string[] = [];
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(message), { TTL: 6 * 3600, urgency: "normal" });
        sent++;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) gone.push(s.id);
        else {
          failed++;
          console.error("taken push", error?.statusCode, error?.body || error?.message);
        }
      }
    })
  );
  await deletePushSubscriptions(gone);
  return { sent, failed };
}
