// Service worker voor de taken-app: maakt hem installeerbaar, laat de laatst geladen
// pagina's zien als je even geen verbinding hebt (de API wordt nooit gecachet)
// en toont pushmeldingen, met knoppen die direct iets doen zonder de app te openen.

const CACHE = "planner-v3";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Next.js-bestanden hebben een hash in de naam: eerst uit de cache.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/taken-pwa/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  // Pagina's: eerst het netwerk, zonder verbinding de laatst bekende versie.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("/app")))
    );
  }
});

// ---------- Pushmeldingen ----------

self.addEventListener("push", (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = { title: "Planner", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || "Planner", {
      body: msg.body || "",
      tag: msg.tag,
      icon: "/taken-pwa/icon-192.png",
      badge: "/taken-pwa/icon-192.png",
      data: { url: msg.url || "/app", taskId: msg.taskId || null },
      actions: (msg.actions || []).slice(0, 2),
    })
  );
});

const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function patchTask(id, patch) {
  const res = await fetch(`/api/taken/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ ...patch, today: localDay() }),
  });
  return res.ok;
}

async function openApp(url) {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const existing = all.find((c) => new URL(c.url).pathname.startsWith("/app"));
  if (existing) {
    await existing.focus();
    if ("navigate" in existing) return existing.navigate(url);
    return existing;
  }
  return self.clients.openWindow(url);
}

self.addEventListener("notificationclick", (event) => {
  const { url, taskId } = event.notification.data || {};
  event.notification.close();
  event.waitUntil(
    (async () => {
      if (taskId && (event.action === "af" || event.action === "morgen")) {
        const ok = await patchTask(
          taskId,
          event.action === "af" ? { status: "af" } : { planDate: localDay(1), blockStart: null }
        ).catch(() => false);
        // Lukt het niet (bijv. uitgelogd of offline), dan de app openen.
        if (!ok) return openApp(url || "/app");
        return self.registration.showNotification(event.action === "af" ? "Afgevinkt" : "Naar morgen verplaatst", {
          tag: "bevestiging",
          icon: "/taken-pwa/icon-192.png",
          silent: true,
        });
      }
      return openApp(url || "/app");
    })()
  );
});
