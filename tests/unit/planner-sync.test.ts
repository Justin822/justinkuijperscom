import { describe, expect, it } from "vitest";
import { fromPlanner } from "@/lib/taken/planner-sync";
import { zonedToUtc } from "@/lib/taken/ics";
import { task } from "./helpers";

const item = (fields: any) => ({ id: "e1", title: "Taak", cancelled: false, start: null, end: null, date: null, updated: 0, ...fields });

describe("fromPlanner", () => {
  it("haalt het blok weg als het in Google verwijderd is", () => {
    const t = task({ blockStart: "2026-10-13T09:00", googleEventId: "e1" });
    expect(fromPlanner(t, null)).toEqual({ blockStart: null, googleEventId: null });
    expect(fromPlanner(task(), null)).toBeNull();
  });

  it("negeert wijzigingen van vóór de laatste sync", () => {
    const t = task({ blockStart: "2026-10-13T09:00", googleSyncedAt: 5000 });
    expect(fromPlanner(t, item({ updated: 4000, start: 0, end: 1 }))).toBeNull();
  });

  it("neemt een verplaatsing en nieuwe duur uit Google over", () => {
    const t = task({ title: "Taak", blockStart: "2026-10-13T09:00", planDate: "2026-10-13", estimate: 30, googleSyncedAt: 1 });
    const start = zonedToUtc("2026-10-14", "14:15");
    const patch = fromPlanner(t, item({ updated: 2, start, end: start + 45 * 60000 }));
    expect(patch).toEqual({ blockStart: "2026-10-14T14:15", planDate: "2026-10-14", estimate: 45 });
  });
});
