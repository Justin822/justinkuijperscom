import { describe, expect, it } from "vitest";
import { addDays, diffDays, formatRelative, isIsoDate, isoWeek, makeDate, mondayOf, nextWeekday, weekday } from "@/lib/taken/dates";
import { TODAY } from "./helpers";

describe("dates", () => {
  it("rekent over maand- en jaargrenzen", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-10-13", "2026-11-13")).toBe(31);
  });

  it("kent weekdagen", () => {
    expect(weekday(TODAY)).toBe(2);
    expect(nextWeekday(TODAY, 2)).toBe(TODAY);
    expect(nextWeekday(TODAY, 1)).toBe("2026-10-19");
  });

  it("weigert ongeldige datums", () => {
    expect(makeDate(2026, 2, 30)).toBeNull();
    expect(isIsoDate("2026-10-13")).toBe(true);
    expect(isIsoDate("13-10-2026")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it("formatteert relatief", () => {
    expect(formatRelative(TODAY, TODAY)).toBe("vandaag");
    expect(formatRelative("2026-10-14", TODAY)).toBe("morgen");
    expect(formatRelative("2026-10-12", TODAY)).toBe("gisteren");
    expect(formatRelative("2026-10-16", TODAY)).toBe("vr 16 okt");
    expect(formatRelative("2027-01-05", TODAY)).toBe("di 5 jan 2027");
  });
});

describe("isoWeek", () => {
  it("klopt rond de jaarwisseling", () => {
    expect(isoWeek("2026-10-13")).toBe(42);
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(isoWeek("2024-12-30")).toBe(1);
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
  });
});
