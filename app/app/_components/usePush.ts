"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./TakenContext";

// Pushmeldingen op dit apparaat: toestemming vragen, abonneren bij de push-dienst van de browser
// en het abonnement bij de server bewaren (of weer weghalen).

function keyBytes(base64url: string): Uint8Array {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushState = "laden" | "niet-ondersteund" | "geblokkeerd" | "uit" | "aan";

export function usePush(publicKey: string | null) {
  const [state, setState] = useState<PushState>("laden");
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("niet-ondersteund");
      return;
    }
    if (Notification.permission === "denied") {
      setState("geblokkeerd");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/app");
    const sub = await reg?.pushManager.getSubscription();
    setEndpoint(sub?.endpoint || null);
    setState(sub ? "aan" : "uit");
  }, []);

  useEffect(() => {
    refresh().catch(() => setState("niet-ondersteund"));
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!publicKey) throw new Error("Pushmeldingen zijn nog niet ingesteld.");
    if ((await Notification.requestPermission()) !== "granted") {
      await refresh();
      throw new Error("Geen toestemming voor meldingen.");
    }
    const reg = (await navigator.serviceWorker.getRegistration("/app")) || (await navigator.serviceWorker.register("/taken-sw.js", { scope: "/app" }));
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    await api("/api/taken/push", { method: "POST", body: JSON.stringify({ action: "subscribe", subscription: sub.toJSON() }) });
    await refresh();
  }, [publicKey, refresh]);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/app");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api("/api/taken/push", { method: "POST", body: JSON.stringify({ action: "unsubscribe", endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe();
    }
    await refresh();
  }, [refresh]);

  const test = useCallback(async () => {
    if (!endpoint) return;
    await api("/api/taken/push", { method: "POST", body: JSON.stringify({ action: "test", endpoint }) });
  }, [endpoint]);

  return { state, enable, disable, test };
}
