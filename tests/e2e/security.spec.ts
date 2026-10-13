import { PASSWORD } from "../../playwright.config";
import { expect, login, test } from "./fixtures";

test.describe("sessies", () => {
  test("uitloggen op dit apparaat", async ({ app }) => {
    await app.goto("/app/instellingen");
    const me = app.locator(".tk-row").filter({ hasText: "dit apparaat" });
    await me.getByRole("button", { name: "Uitloggen" }).click();
    await expect(app.getByPlaceholder("Wachtwoord")).toBeVisible();
    expect((await app.request.get("/api/taken/tasks")).status()).toBe(401);
  });

  test("overal anders uitloggen maakt de andere sessie direct ongeldig", async ({ app, browser }) => {
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await login(otherPage);
    expect((await otherPage.request.get("/api/taken/tasks")).status()).toBe(200);

    await app.goto("/app/instellingen");
    app.once("dialog", (d) => d.accept());
    await app.getByRole("button", { name: "Overal anders uitloggen" }).click();
    await expect(app.getByRole("button", { name: "Overal anders uitloggen" })).toHaveCount(0);

    expect((await otherPage.request.get("/api/taken/tasks")).status()).toBe(401);
    expect((await app.request.get("/api/taken/tasks")).status()).toBe(200);
    await other.close();
  });

  test("een vervalst of oud cookie geeft geen toegang", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext();
    const host = new URL(baseURL!).hostname;
    await ctx.addCookies([
      { name: "taken_session", value: `${"a".repeat(48)}.${"b".repeat(64)}`, domain: host, path: "/" },
      { name: "taken_access", value: "f".repeat(64), domain: host, path: "/" },
    ]);
    expect((await ctx.request.get("/api/taken/tasks")).status()).toBe(401);
    await ctx.close();
  });
});

test("na tien foute pogingen moet je even wachten", async ({ playwright, baseURL }) => {
  test.slow();
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "X-Forwarded-For": `203.0.113.${test.info().project.name === "desktop" ? 1 : 2}` } });
  for (let i = 0; i < 10; i++) {
    expect((await api.post("/api/taken/login", { data: { password: "fout" } })).status()).toBe(401);
  }
  const blocked = await api.post("/api/taken/login", { data: { password: PASSWORD } });
  expect(blocked.status()).toBe(429);
  await api.dispose();
});
