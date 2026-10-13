import { expect, test } from "./fixtures";

// Eigen gebieden: toevoegen in Instellingen, herkend in de snelle invoer, archiveren haalt ze uit de keuzes.

test("eigen gebied toevoegen en een gebied archiveren", async ({ app }) => {
  const before = (await (await app.request.get("/api/taken/settings")).json()).settings.areas;
  try {
    await app.goto("/app/instellingen");
    await app.getByRole("button", { name: "Gebied toevoegen" }).click();
    const fresh = app.locator("fieldset").last();
    await fresh.getByLabel("Naam", { exact: true }).fill("Sport");
    await fresh.getByLabel(/Trefwoorden/).fill("sport, gym");
    await app.getByRole("group", { name: "Felicio" }).getByLabel("Archiveren").check();
    await app.getByRole("button", { name: "Gebieden opslaan" }).click();
    await expect(app.getByText("Gebieden opgeslagen")).toBeVisible();

    const { settings } = await (await app.request.get("/api/taken/settings")).json();
    expect(settings.areas.map((a: any) => a.id)).toContain("sport");
    expect(settings.areas.find((a: any) => a.id === "felicio").archived).toBe(true);

    await app.goto("/app/taken?lijst=open");
    await app.getByLabel("Nieuwe taak").fill("Schema maken, gym");
    await app.getByLabel("Nieuwe taak").press("Enter");
    await expect.poll(async () => (await (await app.request.get("/api/taken/tasks")).json()).tasks[0]?.areaId).toBe("sport");
    await expect(app.getByRole("button", { name: "Sport", exact: true })).toBeVisible();
    await expect(app.getByRole("button", { name: "Felicio", exact: true })).toHaveCount(0);
  } finally {
    await app.request.post("/api/taken/settings", { data: { action: "areas", areas: before } });
  }
});
