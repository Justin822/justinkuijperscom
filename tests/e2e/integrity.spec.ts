import { expect, test } from "./fixtures";

// Gelijktijdige wijzigingen: niets mag stilletjes verloren gaan.

test("notitie die elders is gewijzigd: jouw versie wordt een kopie", async ({ app }) => {
  const { note } = await (await app.request.post("/api/taken/notes", { data: { body: "Boodschappen\nmelk" } })).json();
  await app.goto(`/app/notities/${note.id}`);
  const editor = app.getByLabel("Notitie");
  await expect(editor).toHaveValue("melk");

  // Een ander apparaat past de tekst aan (zonder dat deze editor het weet).
  const other = await app.request.patch(`/api/taken/notes/${note.id}`, { data: { body: "Boodschappen\nkaas" } });
  expect(other.ok()).toBe(true);

  await editor.fill("melk\neieren");
  await expect(app.getByText("Jouw versie staat in een kopie")).toBeVisible({ timeout: 5000 });
  await expect(editor).toHaveValue("kaas");

  const { notes } = await (await app.request.get("/api/taken/notes")).json();
  const bodies = notes.map((n: any) => n.body);
  expect(bodies).toHaveLength(2);
  expect(bodies).toEqual(expect.arrayContaining(["Boodschappen (jouw versie)\nmelk\neieren", "Boodschappen\nkaas"]));
});

test("vastpinnen telt niet als conflict", async ({ app }) => {
  const { note } = await (await app.request.post("/api/taken/notes", { data: { body: "Idee\neen" } })).json();
  await app.goto(`/app/notities/${note.id}`);
  await app.request.patch(`/api/taken/notes/${note.id}`, { data: { pinned: true } });
  await app.getByLabel("Notitie").fill("een\ntwee");
  await expect
    .poll(async () => (await (await app.request.get("/api/taken/notes")).json()).notes.find((n: any) => n.id === note.id).body)
    .toBe("Idee\neen\ntwee");
});

test("gelijktijdige wijzigingen aan één taak blijven allemaal staan", async ({ app }) => {
  await app.request.post("/api/taken/tasks", { data: { tasks: [{ title: "Druk", status: "gepland" }] } });
  const id = (await (await app.request.get("/api/taken/tasks")).json()).tasks[0].id;
  await Promise.all([
    app.request.patch(`/api/taken/tasks/${id}`, { data: { estimate: 45 } }),
    app.request.patch(`/api/taken/tasks/${id}`, { data: { impact: "hoog" } }),
    app.request.patch(`/api/taken/tasks/${id}`, { data: { note: "context" } }),
    app.request.patch(`/api/taken/tasks/${id}`, { data: { project: "Website" } }),
  ]);
  const t = (await (await app.request.get("/api/taken/tasks")).json()).tasks[0];
  expect(t).toMatchObject({ estimate: 45, impact: "hoog", note: "context", project: "Website" });
});

test("de geplande ronde weigert zonder geheim", async ({ playwright, baseURL }) => {
  const api = await playwright.request.newContext({ baseURL });
  expect((await api.get("/api/taken/cron")).status()).toBe(401);
  expect((await api.get("/api/taken/cron", { headers: { Authorization: "Bearer fout" } })).status()).toBe(401);
  await api.dispose();
});

test("mail-radar vraagt eerst om Google te koppelen", async ({ app }) => {
  await app.goto("/app/instellingen");
  await expect(app.getByRole("heading", { name: "Mail-radar" })).toBeVisible();
  await expect(app.getByText("Koppel eerst Google Agenda hierboven.")).toBeVisible();
});
