import { expect, test } from "./fixtures";

// Alles moet ook met alleen een toetsenbord kunnen.

test.describe("toetsenbord", () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== "desktop", "toetsenbord op de laptop");
  });

  test("? toont de sneltoetsen, Esc sluit", async ({ app }) => {
    await app.keyboard.press("?");
    await expect(app.getByRole("dialog", { name: "Sneltoetsen" })).toBeVisible();
    await app.keyboard.press("Escape");
    await expect(app.getByRole("dialog", { name: "Sneltoetsen" })).toHaveCount(0);
  });

  test("taak openen met Enter, Tab blijft in het venster, focus komt terug", async ({ app }) => {
    await app.request.post("/api/taken/tasks", { data: { tasks: [{ title: "Toetsentaak", status: "gepland" }] } });
    await app.goto("/app/taken?lijst=open");
    const row = app.getByRole("button", { name: "Toetsentaak: openen" });
    await row.focus();
    await app.keyboard.press("Enter");
    const dialog = app.getByRole("dialog", { name: "Taak bewerken" });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 40; i++) await app.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await app.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeFocused();
  });

  test("agendablok met Tab bereiken en met de pijltjes verschuiven", async ({ app }) => {
    const today = await app.evaluate(() => new Intl.DateTimeFormat("en-CA").format(new Date()));
    await app.request.post("/api/taken/tasks", {
      data: { tasks: [{ title: "Blok", status: "gepland", planDate: today, blockStart: `${today}T10:00`, estimate: 30 }] },
    });
    await app.goto("/app/week");
    const block = app.getByRole("button", { name: /^Blok, 10:00 tot 10:30/ });
    await block.focus();
    await app.keyboard.press("ArrowDown");
    await app.keyboard.press("ArrowDown");
    await expect
      .poll(async () => (await (await app.request.get("/api/taken/tasks")).json()).tasks[0].blockStart, { timeout: 5000 })
      .toBe(`${today}T10:30`);
  });
});
