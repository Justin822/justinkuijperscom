import { expect, test } from "./fixtures";

// Offline-first: werken zonder verbinding, en alles komt daarna vanzelf op de server.

const serverTasks = async (app: any) => (await (await app.request.get("/api/taken/tasks")).json()).tasks as any[];

test("offline een taak toevoegen en afvinken; online gaat alles mee", async ({ app, context }) => {
  await app.request.post("/api/taken/tasks", { data: { tasks: [{ title: "Al bestaand", status: "gepland" }] } });
  await app.goto("/app/taken?lijst=open");
  await expect(app.getByText("Al bestaand")).toBeVisible();

  await context.setOffline(true);
  await expect(app.getByRole("status").filter({ hasText: "Offline" })).toBeVisible();

  await app.getByLabel("Nieuwe taak").fill("Offline bedacht morgen");
  await app.getByLabel("Nieuwe taak").press("Enter");
  await app.locator(".tk-row").filter({ hasText: "Al bestaand" }).getByLabel("Afvinken").click();
  await expect(app.getByRole("status").filter({ hasText: "2 wijzigingen wachten" })).toBeVisible();

  // Nog niets op de server (de test praat zelf wel met de server).
  expect((await serverTasks(app)).map((t) => t.title)).toEqual(["Al bestaand"]);

  await context.setOffline(false);
  await expect(app.getByRole("status").filter({ hasText: "wacht" })).toHaveCount(0, { timeout: 10000 });
  await expect
    .poll(async () => (await serverTasks(app)).map((t) => `${t.title}:${t.status}`).sort())
    .toEqual(["Al bestaand:af", "Offline bedacht:inbox"]);
});

test("de app opent met je laatste gegevens als de server niet bereikbaar is", async ({ app }) => {
  await app.request.post("/api/taken/tasks", { data: { tasks: [{ title: "Uit de lokale kopie", status: "gepland" }] } });
  await app.goto("/app/taken?lijst=open");
  await expect(app.getByText("Uit de lokale kopie")).toBeVisible();
  await app.waitForTimeout(800); // kopie wordt na een halve seconde bewaard

  await app.route("**/api/taken/**", (route) => route.abort("internetdisconnected"));
  await app.reload();
  await expect(app.getByText("Uit de lokale kopie")).toBeVisible();
  await app.unroute("**/api/taken/**");
});

test("een offline taak die twee keer wordt verstuurd, staat er maar één keer", async ({ app }) => {
  const task = { id: "mgq1abc-dubbel", title: "Eén keer", status: "gepland" };
  await app.request.post("/api/taken/tasks", { data: { tasks: [task] } });
  await app.request.post("/api/taken/tasks", { data: { tasks: [{ ...task, title: "Overschreven?" }] } });
  const tasks = await serverTasks(app);
  expect(tasks.filter((t) => t.id === task.id).map((t) => t.title)).toEqual(["Eén keer"]);
});

test("uitloggen wist de lokale kopie", async ({ app }) => {
  await app.goto("/app/taken");
  await app.waitForTimeout(800);
  const has = () =>
    app.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const req = indexedDB.open("planner", 1);
          req.onsuccess = () => {
            const get = req.result.transaction("snapshot").objectStore("snapshot").get("data");
            get.onsuccess = () => resolve(Boolean(get.result));
            get.onerror = () => resolve(false);
          };
          req.onerror = () => resolve(false);
        })
    );
  expect(await has()).toBe(true);
  await app.goto("/app/instellingen");
  await app.locator(".tk-row").filter({ hasText: "dit apparaat" }).getByRole("button", { name: "Uitloggen" }).click();
  await expect(app.getByPlaceholder("Wachtwoord")).toBeVisible();
  await expect.poll(has).toBe(false);
});
