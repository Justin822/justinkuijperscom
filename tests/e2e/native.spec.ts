import { expect, test } from "./fixtures";

// Native gevoel: thema, terug-knop en vegen.

test("thema kiezen werkt meteen en blijft na herladen", async ({ app }) => {
  await app.goto("/app/instellingen");
  await app.getByRole("radio", { name: "Donker" }).click();
  await expect(app.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = () => app.evaluate(() => getComputedStyle(document.querySelector(".tk")!).backgroundColor);
  expect(await bg()).toBe("rgb(10, 10, 10)");
  await app.reload();
  await expect(app.locator("html")).toHaveAttribute("data-theme", "dark");
  await app.getByRole("radio", { name: "Systeem" }).click();
  await expect(app.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

test("terug sluit het taakvenster en bewaart, zonder de pagina te verlaten", async ({ app }) => {
  await app.request.post("/api/taken/tasks", { data: { tasks: [{ title: "Terugtaak", status: "gepland" }] } });
  await app.goto("/app/taken?lijst=open");
  await app.getByText("Terugtaak").click();
  await app.getByLabel("Titel").fill("Terugtaak aangepast");
  await app.goBack();
  await expect(app.getByRole("dialog")).toHaveCount(0);
  await expect(app).toHaveURL(/\/app\/taken\?lijst=open$/);
  await expect
    .poll(async () => (await (await app.request.get("/api/taken/tasks")).json()).tasks[0].title)
    .toBe("Terugtaak aangepast");
  // Sluiten met de knop laat geen extra stap in de geschiedenis achter.
  await app.getByText("Terugtaak aangepast").click();
  await app.getByLabel("Sluiten").click();
  await app.goBack();
  await expect(app).not.toHaveURL(/lijst=open$/);
});

test("vegen naar rechts vinkt af, naar links schuift naar morgen", async ({ app }) => {
  test.skip(test.info().project.name !== "telefoon", "vegen is voor touch");
  await app.request.post("/api/taken/tasks", {
    data: { tasks: [{ title: "Veeg af", status: "gepland" }, { title: "Veeg weg", status: "gepland" }] },
  });
  await app.goto("/app/taken?lijst=open");
  const swipe = async (title: string, dx: number) => {
    const box = (await app.locator(".tk-row").filter({ hasText: title }).locator(".tk-row-title").boundingBox())!;
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    const cdp = await app.context().newCDPSession(app);
    const touch = (type: string, px: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: px, y }] });
    await touch("touchStart", x);
    for (let i = 1; i <= 8; i++) await touch("touchMove", x + (dx * i) / 8);
    await touch("touchEnd", x + dx);
  };
  await swipe("Veeg af", 150);
  await swipe("Veeg weg", -150);
  await expect
    .poll(async () => {
      const { tasks } = await (await app.request.get("/api/taken/tasks")).json();
      return tasks.map((t: any) => `${t.title}:${t.status}:${t.planDate ? "gepland" : "-"}`).sort();
    })
    .toEqual(["Veeg af:af:-", "Veeg weg:gepland:gepland"]);
});
