import { expect, login, test } from "./fixtures";
import { PASSWORD } from "../../playwright.config";

test.describe("toegang", () => {
  test("zonder cookie zie je het inlogscherm en weigert de API", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByPlaceholder("Wachtwoord")).toBeVisible();
    const res = await page.request.get("/api/taken/tasks");
    expect(res.status()).toBe(401);
  });

  test("een fout wachtwoord geeft een melding", async ({ page }) => {
    await page.goto("/app");
    await page.getByPlaceholder("Wachtwoord").fill(PASSWORD + "x");
    await page.getByRole("button", { name: "Inloggen" }).click();
    await expect(page.getByText("Dat wachtwoord klopt niet.")).toBeVisible();
  });

  test("inloggen opent de app", async ({ page }) => {
    await login(page);
  });
});

test("snelle invoer maakt een taak met herkende velden", async ({ app }) => {
  await app.getByLabel("Nieuwe taak").fill("Offerte Jansen morgen, Appèl, half uur");
  await app.getByLabel("Nieuwe taak").press("Enter");
  await expect(app.getByText("Offerte Jansen").first()).toBeVisible();

  const { tasks } = await (await app.request.get("/api/taken/tasks")).json();
  expect(tasks).toHaveLength(1);
  expect(tasks[0]).toMatchObject({ title: "Offerte Jansen", areaId: "appel", estimate: 30 });
});

test("afvinken en ongedaan maken", async ({ app }) => {
  await app.request.post("/api/taken/tasks", { data: { tasks: [{ title: "Afvinktaak", status: "gepland" }] } });
  await app.goto("/app/taken?lijst=open");
  const row = app.locator(".tk-row, li, [data-task]").filter({ hasText: "Afvinktaak" }).first();
  await row.getByLabel("Afvinken").click();
  await app.getByRole("button", { name: /ongedaan/i }).click();

  await expect
    .poll(async () => (await (await app.request.get("/api/taken/tasks")).json()).tasks[0].status)
    .toBe("gepland");
});
test("een terugkerende taak afvinken en terugdraaien laat geen dubbele achter", async ({ app }) => {
  await app.request.post("/api/taken/tasks", {
    data: { tasks: [{ title: "Elke dag", status: "gepland", repeat: { every: 1, unit: "dag", weekdays: null } }] },
  });
  await app.goto("/app/taken?lijst=open");
  const row = app.locator(".tk-row, li, [data-task]").filter({ hasText: "Elke dag" }).first();
  await row.getByLabel("Afvinken").click();
  await app.getByRole("button", { name: /ongedaan/i }).click();

  await expect
    .poll(async () => {
      const { tasks } = await (await app.request.get("/api/taken/tasks")).json();
      return tasks.map((t: any) => `${t.status}:${t.repeat ? "herhaalt" : "-"}`).sort();
    })
    .toEqual(["gepland:herhaalt"]);
});

test("twee keer de dag afsluiten schuift taken maar één keer door", async ({ app }) => {
  const today = await app.evaluate(() => new Intl.DateTimeFormat("en-CA").format(new Date()));
  await app.request.post("/api/taken/tasks", {
    data: { tasks: [{ title: "Bleef liggen", status: "gepland", planDate: today, blockStart: `${today}T10:00` }] },
  });
  const { tasks } = await (await app.request.get("/api/taken/tasks")).json();
  const id = tasks[0].id;
  for (let i = 0; i < 2; i++) {
    const res = await app.request.post("/api/taken/close", { data: { date: today, postpone: [id] } });
    expect(res.ok()).toBe(true);
  }
  const after = (await (await app.request.get("/api/taken/tasks")).json()).tasks[0];
  expect(after.postponed).toBe(1);
  expect(after.planDate > today).toBe(true);
  expect(after.blockStart).toBeNull();
});

test("Esc in het taakvenster bewaart je wijziging", async ({ app }) => {
  await app.request.post("/api/taken/tasks", { data: { tasks: [{ title: "Oude titel", status: "gepland" }] } });
  await app.goto("/app/taken?lijst=open");
  await app.getByText("Oude titel").click();
  await app.getByLabel("Titel", { exact: true }).fill("Nieuwe titel");
  await app.keyboard.press("Escape");
  await expect(app.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(async () => (await (await app.request.get("/api/taken/tasks")).json()).tasks[0].title)
    .toBe("Nieuwe titel");
});
