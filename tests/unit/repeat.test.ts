import { describe, expect, it } from "vitest";
import { firstDate, nextDate, repeatLabel, spawnNext, undoSpawn } from "@/lib/taken/repeat";
import { task, TODAY } from "./helpers";

describe("nextDate", () => {
  it("valt terug op de laatste dag van een kortere maand", () => {
    expect(nextDate({ every: 1, unit: "maand", weekdays: null }, "2026-01-31", "2026-01-31")).toBe("2026-02-28");
  });

  it("slaat het weekend over bij werkdagen", () => {
    expect(nextDate({ every: 1, unit: "dag", weekdays: [1, 2, 3, 4, 5] }, "2026-10-16", "2026-10-16")).toBe("2026-10-19");
  });

  it("slaat bij om-de-2-weken een week over", () => {
    expect(nextDate({ every: 2, unit: "week", weekdays: [1] }, "2026-10-19", "2026-10-19")).toBe("2026-11-02");
  });

  it("haalt gemiste keren niet allemaal in", () => {
    expect(nextDate({ every: 1, unit: "dag", weekdays: null }, "2026-10-01", TODAY)).toBe("2026-10-14");
  });
});

describe("firstDate", () => {
  it("is vandaag als die dag past, anders de eerstvolgende", () => {
    expect(firstDate({ every: 1, unit: "dag", weekdays: null }, TODAY)).toBe(TODAY);
    expect(firstDate({ every: 1, unit: "week", weekdays: [5] }, TODAY)).toBe("2026-10-16");
  });
});

describe("spawnNext", () => {
  it("maakt de volgende taak en schuift de deadline mee", () => {
    const t = task({ planDate: TODAY, deadline: "2026-10-15", repeat: { every: 1, unit: "dag", weekdays: null }, blockStart: `${TODAY}T09:00`, postponed: 2, focusMinutes: 50 });
    const next = spawnNext(t, TODAY, 1000);
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe(t.id);
    expect(next!.planDate).toBe("2026-10-14");
    expect(next!.deadline).toBe("2026-10-16");
    expect(next!.status).toBe("gepland");
    expect(next!.blockStart).toBeNull();
    expect(next!.postponed).toBe(0);
    expect(next!.focusMinutes).toBe(0);
  });

  it("geeft null zonder herhaling", () => {
    expect(spawnNext(task(), TODAY)).toBeNull();
  });
});

describe("repeatLabel", () => {
  it("beschrijft herhalingen in gewone taal", () => {
    expect(repeatLabel({ every: 1, unit: "dag", weekdays: [1, 2, 3, 4, 5] })).toBe("elke werkdag");
    expect(repeatLabel({ every: 2, unit: "week", weekdays: [1] })).toBe("om de 2 weken op maandag");
    expect(repeatLabel({ every: 3, unit: "maand", weekdays: null })).toBe("elke 3 maanden");
  });
});

describe("undoSpawn", () => {
  const repeat = { every: 1, unit: "dag" as const, weekdays: null };

  it("zet de herhaling terug en ruimt de volgende keer op", () => {
    const t = task({ planDate: TODAY, repeat });
    const next = spawnNext(t, TODAY, 1000)!;
    const reopened = { ...t, repeat: null, status: "gepland" as const };
    const result = undoSpawn(reopened, [reopened, next]);
    expect(result.task.repeat).toEqual(repeat);
    expect(result.remove?.id).toBe(next.id);
  });

  it("laat een volgende keer staan waar je al aan hebt gewerkt", () => {
    const t = task({ planDate: TODAY, repeat });
    const next = { ...spawnNext(t, TODAY, 1000)!, updatedAt: 2000 };
    const result = undoSpawn({ ...t, repeat: null }, [next]);
    expect(result.remove).toBeNull();
    expect(result.task.repeat).toBeNull();
  });

  it("doet niets bij een taak die nog herhaalt", () => {
    const t = task({ repeat });
    expect(undoSpawn(t, [])).toEqual({ task: t, remove: null });
  });
});
