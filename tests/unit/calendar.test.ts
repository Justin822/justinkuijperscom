import { describe, expect, it } from "vitest";
import { layoutDay } from "@/app/app/_components/calendar/layout";
import { applyDrag, durationLabel, fmt, snap, toMinutes } from "@/app/app/_components/calendar/time";

describe("layoutDay", () => {
  it("zet overlappende blokken naast elkaar", () => {
    const placed = layoutDay([
      { id: "a", start: 0, end: 60 },
      { id: "b", start: 30, end: 90 },
      { id: "c", start: 120, end: 150 },
    ]);
    expect(placed.get("a")).toEqual({ id: "a", left: 0, width: 0.5 });
    expect(placed.get("b")).toEqual({ id: "b", left: 0.5, width: 0.5 });
    expect(placed.get("c")).toEqual({ id: "c", left: 0, width: 1 });
  });
});

describe("time", () => {
  it("rekent tussen tijden en minuten", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(fmt(570)).toBe("09:30");
    expect(snap(37)).toBe(30);
    expect(durationLabel(90)).toBe("1u 30m");
    expect(durationLabel(45)).toBe("45 min");
  });

  it("begrenst slepen en oprekken", () => {
    expect(applyDrag("move", { start: 600, end: 660 }, 1430, 0)).toEqual({ start: 1380, end: 1440 });
    expect(applyDrag("resize-bottom", { start: 600, end: 660 }, 590, 0)).toEqual({ start: 600, end: 615 });
    expect(applyDrag("resize-top", { start: 600, end: 660 }, -20, 0)).toEqual({ start: 0, end: 660 });
    expect(applyDrag("create", { start: 600, end: 600 }, 540, 0)).toEqual({ start: 540, end: 600 });
  });
});
