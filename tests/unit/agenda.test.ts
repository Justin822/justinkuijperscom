import { describe, expect, it } from "vitest";
import { blockInterval, firstFreeSlot, freeMinutes } from "@/lib/taken/agenda";
import { autoSchedule } from "@/lib/taken/plan";
import { task } from "./helpers";

const H = 3600000;
const M = 60000;

describe("freeMinutes", () => {
  it("telt overlappende afspraken maar één keer", () => {
    expect(freeMinutes([[1 * H, 3 * H], [2 * H, 4 * H]], 0, 8 * H)).toBe(5 * 60);
  });

  it("rekent vanaf 'from'", () => {
    expect(freeMinutes([], 0, 8 * H, 6 * H)).toBe(120);
    expect(freeMinutes([], 0, 8 * H, 9 * H)).toBe(0);
  });
});

describe("firstFreeSlot", () => {
  it("vindt de eerste plek op een heel kwartier", () => {
    expect(firstFreeSlot([[0, 70 * M]], 0, 8 * H, 30 * M)).toBe(75 * M);
  });

  it("geeft null als het niet past", () => {
    expect(firstFreeSlot([[0, 8 * H]], 0, 8 * H, 15 * M)).toBeNull();
  });
});

describe("autoSchedule", () => {
  it("plant op volgorde en slaat over wat niet past", () => {
    const placements = autoSchedule(
      [
        { id: "a", estimate: 60 },
        { id: "b", estimate: 240 },
        { id: "c", estimate: null },
      ],
      [[1 * H, 2 * H]],
      0,
      3 * H
    );
    expect(placements).toEqual([
      { taskId: "a", start: 0, end: 1 * H },
      { taskId: "c", start: 2 * H, end: 2 * H + 30 * M },
    ]);
  });
});

describe("blockInterval", () => {
  it("gebruikt de inschatting als duur (standaard 30 min)", () => {
    const [start, end] = blockInterval(task({ blockStart: "2026-10-13T09:00" }))!;
    expect(end - start).toBe(30 * M);
    expect(blockInterval(task())).toBeNull();
  });
});
