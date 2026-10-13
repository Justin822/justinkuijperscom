import { readFile } from "fs/promises";
import { expect, test } from "./fixtures";

test("delen vanuit een andere app zet een taak met link in de Inbox", async ({ app }) => {
  const text = encodeURIComponent("Lezen morgen https://example.com/artikel");
  await app.goto(`/app/delen?title=${encodeURIComponent("Een artikel")}&text=${text}`);
  await expect(app.getByLabel("Gedeelde tekst")).toHaveValue("Lezen morgen");
  await expect(app.getByText("Link: https://example.com/artikel")).toBeVisible();
  await expect(app.locator(".tk-tag").first()).toContainText("morgen");
  await app.getByRole("button", { name: "Zet in Inbox" }).click();
  await expect(app).toHaveURL(/\/app\/taken\?lijst=inbox/);

  const { tasks } = await (await app.request.get("/api/taken/tasks")).json();
  expect(tasks).toHaveLength(1);
  expect(tasks[0]).toMatchObject({ title: "Lezen", source: "gedeeld", note: "https://example.com/artikel" });
});

test("alleen een link delen gebruikt de paginatitel", async ({ app }) => {
  await app.goto(`/app/delen?title=${encodeURIComponent("Mooie site")}&url=${encodeURIComponent("https://example.com")}`);
  await expect(app.getByLabel("Gedeelde tekst")).toHaveValue("Mooie site");
});

test("het manifest maakt de app een deeldoel met snelkoppelingen", async ({ app }) => {
  const manifest = await (await app.request.get("/taken-pwa/manifest.webmanifest")).json();
  expect(manifest.share_target).toMatchObject({ action: "/app/delen", method: "GET" });
  expect(manifest.shortcuts.map((s: any) => s.url)).toContain("/app?nieuw=1");
  for (const s of manifest.shortcuts) expect(s.url.startsWith("/app")).toBe(true);
});

test("snelkoppeling 'Nieuwe taak' zet de cursor in het invoerveld", async ({ app }) => {
  await app.goto("/app?nieuw=1");
  await expect(app.getByLabel("Nieuwe taak")).toBeFocused();
  await expect(app).toHaveURL(/\/app$/);
});

test("het importbestand voor HTTP Shortcuts bevat de nieuwe sleutel", async ({ app }) => {
  await app.goto("/app/instellingen");
  await app.getByLabel("Naam van de sleutel").fill("Android");
  await app.getByRole("button", { name: "Nieuwe sleutel" }).click();
  const token = (await app.getByTestId("nieuwe-sleutel").textContent())!.trim();
  const [download] = await Promise.all([app.waitForEvent("download"), app.getByRole("button", { name: "Download voor HTTP Shortcuts" }).click()]);
  expect(download.suggestedFilename()).toBe("planner-snelknoppen.json");
  const data = JSON.parse(await readFile((await download.path())!, "utf8"));
  const shortcuts = data.categories[0].shortcuts;
  expect(shortcuts.map((s: any) => s.authToken)).toEqual([token, token]);
  expect(shortcuts[0].url).toMatch(/\/api\/taken\/capture\?format=text$/);
});

test("in de Inbox zie en filter je waar een taak vandaan komt", async ({ app }) => {
  await app.request.post("/api/taken/tasks", {
    data: {
      tasks: [
        { title: "Uit de mail", source: "mail-radar", mailLink: "https://mail.google.com/mail/u/0/#all/abc" },
        { title: "Gedeelde pagina", source: "gedeeld", note: "https://example.com/x" },
        { title: "Zelf getypt" },
      ],
    },
  });
  await app.goto("/app/taken?lijst=inbox");
  const mailRow = app.locator(".tk-row").filter({ hasText: "Uit de mail" });
  await expect(mailRow.getByRole("link", { name: /uit je mail/ })).toHaveAttribute("href", "https://mail.google.com/mail/u/0/#all/abc");
  await expect(app.locator(".tk-row").filter({ hasText: "Gedeelde pagina" }).getByRole("link", { name: /gedeeld/ })).toHaveAttribute("href", "https://example.com/x");

  await app.getByRole("button", { name: /^Mail/ }).click();
  await expect(app.locator(".tk-row")).toHaveCount(1);
  await app.getByRole("button", { name: "Alle bronnen" }).click();
  await expect(app.locator(".tk-row")).toHaveCount(3);
});
