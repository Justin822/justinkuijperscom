import { request as playwrightRequest } from "@playwright/test";
import { expect, test } from "./fixtures";

// Snel invoeren met een sleutel: zonder inlogcookie, zoals een snelknop op je telefoon.

test("sleutel aanmaken, taak invoeren, top 3 lezen en intrekken", async ({ app, baseURL }) => {
  await app.goto("/app/instellingen");
  await app.getByLabel("Naam van de sleutel").fill("Testtelefoon");
  await app.getByRole("button", { name: "Nieuwe sleutel" }).click();
  const token = (await app.getByTestId("nieuwe-sleutel").textContent())!.trim();
  expect(token).toMatch(/^pl_/);

  const phone = await playwrightRequest.newContext({ baseURL });
  const auth = { Authorization: `Bearer ${token}` };

  expect((await phone.post("/api/taken/capture", { data: "Zonder sleutel" })).status()).toBe(401);
  expect((await phone.post("/api/taken/capture", { data: "Fout", headers: { Authorization: "Bearer pl_fout" } })).status()).toBe(401);

  const res = await phone.post("/api/taken/capture?format=text", {
    data: "Offerte Jansen morgen, Appèl, half uur",
    headers: { ...auth, "Content-Type": "text/plain" },
  });
  expect(res.status()).toBe(201);
  expect(await res.text()).toBe("✓ Offerte Jansen (morgen)");

  const shared = await phone.post("/api/taken/capture", {
    data: { title: "Artikel lezen", text: "https://example.com/artikel", source: "gedeeld" },
    headers: auth,
  });
  expect(shared.status()).toBe(201);

  const note = await phone.post("/api/taken/capture", { data: { text: "notitie: idee" }, headers: auth });
  expect(await note.json()).toMatchObject({ note: { id: expect.any(String) } });

  const { tasks } = await (await app.request.get("/api/taken/tasks")).json();
  expect(tasks.map((t: any) => [t.title, t.source, t.areaId]).sort()).toEqual([
    ["Artikel lezen", "gedeeld", null],
    ["Offerte Jansen", "snelknop", "appel"],
  ]);
  expect(tasks.find((t: any) => t.source === "gedeeld").note).toBe("https://example.com/artikel");

  const today = await phone.get("/api/taken/capture/today", { headers: auth });
  expect(today.ok()).toBe(true);
  expect(await today.json()).toMatchObject({ top3: expect.any(Array) });

  // De sleutel staat in de lijst; intrekken maakt hem onbruikbaar.
  await app.getByRole("button", { name: "Klaar" }).click();
  app.once("dialog", (d) => d.accept());
  await app.getByLabel("Sleutel Testtelefoon intrekken").click();
  await expect(app.getByLabel("Sleutel Testtelefoon intrekken")).toHaveCount(0);
  expect((await phone.post("/api/taken/capture", { data: "Na intrekken", headers: auth })).status()).toBe(401);
  await phone.dispose();
});
