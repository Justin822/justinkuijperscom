import { expect, test } from "./fixtures";

// Op een telefoon mag geen scherm breder zijn dan het scherm zelf (anders zoomt de browser uit
// en schuift de pagina opzij; tikken komt dan op de verkeerde plek terecht).
const PAGES = ["/app", "/app/taken", "/app/week", "/app/notities", "/app/instellingen", "/app/review", "/app/afsluiten", "/app/delen?text=Lezen"];

test("geen horizontaal scrollen op de telefoon", async ({ app }) => {
  test.skip(test.info().project.name !== "telefoon", "alleen op het telefoonformaat");
  for (const path of PAGES) {
    await app.goto(path);
    await app.waitForLoadState("networkidle");
    const { scroll, width, wide } = await app.evaluate(() => {
      const w = document.documentElement.clientWidth;
      return {
        scroll: document.documentElement.scrollWidth,
        width: w,
        wide: Array.from(document.querySelectorAll("body *"))
          .filter((el) => el.getBoundingClientRect().right > w + 1)
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 60)}`),
      };
    });
    expect({ path, scroll, wide }).toEqual({ path, scroll: width, wide: [] });
  }
});
