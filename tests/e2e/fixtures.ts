import { expect, test as base, type Page } from "@playwright/test";
import { PASSWORD } from "../../playwright.config";

/** Inloggen via het echte inlogscherm; daarna staat het cookie in de context. */
export async function login(page: Page) {
  await page.goto("/app");
  await page.getByPlaceholder("Wachtwoord").fill(PASSWORD);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await expect(page.getByLabel("Nieuwe taak")).toBeVisible();
}

/** Elke test begint leeg: alle taken en notities via de API weg. */
async function clearTasks(page: Page) {
  const { tasks } = await (await page.request.get("/api/taken/tasks")).json();
  for (const t of tasks) await page.request.delete(`/api/taken/tasks/${t.id}`);
  const { notes } = await (await page.request.get("/api/taken/notes")).json();
  for (const n of notes) await page.request.delete(`/api/taken/notes/${n.id}`);
}

export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    await login(page);
    await clearTasks(page);
    await page.reload();
    await expect(page.getByLabel("Nieuwe taak")).toBeVisible();
    await use(page);
  },
});

export { expect };
