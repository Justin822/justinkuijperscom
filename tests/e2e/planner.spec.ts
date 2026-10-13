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
