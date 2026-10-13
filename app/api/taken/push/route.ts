import { NextResponse } from "next/server";
import { pushConfigured, sendPush, subscriptionId, validSubscription } from "@/lib/taken/push";
import { fail } from "@/lib/taken/server";
import { deviceName, requireAccess } from "@/lib/taken/session";
import { deletePushSubscriptions, savePushSubscription } from "@/lib/taken/store";

export const dynamic = "force-dynamic";

// Pushmeldingen op dit apparaat aan- of uitzetten, en een testmelding sturen.
export async function POST(request: Request) {
  const denied = await requireAccess(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    if (!pushConfigured()) return NextResponse.json({ error: "Pushmeldingen zijn nog niet ingesteld (VAPID-sleutels)." }, { status: 503 });

    if (body?.action === "subscribe") {
      const sub = validSubscription(body.subscription);
      if (!sub) return NextResponse.json({ error: "Ongeldig abonnement." }, { status: 400 });
      const id = subscriptionId(sub.endpoint);
      await savePushSubscription({ id, ...sub, device: deviceName(request.headers.get("user-agent")), createdAt: Date.now() });
      return NextResponse.json({ id });
    }
    if (body?.action === "unsubscribe" && typeof body.endpoint === "string") {
      await deletePushSubscriptions([subscriptionId(body.endpoint)]);
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "test" && typeof body.endpoint === "string") {
      const result = await sendPush(
        { title: "Planner", body: "Meldingen werken op dit apparaat.", tag: "test", url: "/app/instellingen" },
        [subscriptionId(body.endpoint)]
      );
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
  } catch (error) {
    return fail("push POST", error, "Kon de meldingen niet instellen.");
  }
}
