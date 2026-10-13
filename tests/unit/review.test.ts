import { describe, expect, it } from "vitest";
import { computeReview } from "@/lib/taken/review";
import type { DayPlan } from "@/lib/taken/types";
import { task } from "./helpers";

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const at = (date: string) => Date.parse(`${date}T12:00:00Z`);

describe("computeReview", () => {
  it("telt top-3-dagen, afgesloten dagen en inbox zero", () => {
    const a = task({ status: "af", doneAt: at("2026-10-12"), areaId: "appel" });
    const b = task({ status: "af", doneAt: at("2026-10-12") });
    const c = task({ status: "gepland", postponed: 3 });
    const dates = ["2026-10-12", "2026-10-13"];
    const plans: DayPlan[] = [
      { date: dates[0], top3: [{ id: a.id, reason: "" }, { id: b.id, reason: "" }], swapped: [], areas: [], closedAt: 1, inboxAtClose: 0 },
      { date: dates[1], top3: [{ id: c.id, reason: "" }], swapped: [], areas: [], closedAt: null },
    ];
    const r = computeReview(dates, plans, [a, b, c], dayOf, [{ appel: 50, geen: 10 }, { appel: 25 }]);
    expect(r.top3Days).toBe(1);
    expect(r.closedDays).toBe(1);
    expect(r.inboxZeroDays).toBe(1);
    expect(r.doneCount).toBe(2);
    expect(r.mostPostponed.map((t) => t.id)).toEqual([c.id]);
    expect(r.areas.find((x) => x.areaId === "appel")).toMatchObject({ done: 1, focusMinutes: 75 });
    expect(r.focusTotal).toBe(85);
  });

  it("telt focustijd van eerdere weken niet mee", () => {
    const old = task({ areaId: "appel", focusMinutes: 600 });
    const r = computeReview(["2026-10-12"], [null], [old], dayOf, [{}]);
    expect(r.focusTotal).toBe(0);
  });
});
