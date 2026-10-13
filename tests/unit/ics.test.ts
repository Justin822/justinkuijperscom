import { describe, expect, it } from "vitest";
import { expandEvents, parseIcs, zonedToUtc } from "@/lib/taken/ics";

const ICS = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "UID:once",
  "SUMMARY:Lunch",
  "DTSTART;TZID=Europe/Amsterdam:20261013T120000",
  "DTEND;TZID=Europe/Amsterdam:20261013T130000",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:weekly",
  "SUMMARY:Standup",
  "DTSTART;TZID=Europe/Amsterdam:20261012T090000",
  "DTEND;TZID=Europe/Amsterdam:20261012T091500",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,WE",
  "EXDATE;TZID=Europe/Amsterdam:20261014T090000",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:allday",
  "SUMMARY:Vrij",
  "DTSTART;VALUE=DATE:20261016",
  "DTEND;VALUE=DATE:20261017",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("ics", () => {
  const from = zonedToUtc("2026-10-12", "00:00");
  const to = zonedToUtc("2026-10-20", "00:00");
  const events = expandEvents(parseIcs(ICS), from, to, "Test");

  it("rekent tijdzones goed om", () => {
    const lunch = events.find((e) => e.title === "Lunch")!;
    expect(lunch.start).toBe(Date.parse("2026-10-13T10:00:00Z"));
    expect(lunch.end - lunch.start).toBe(3600000);
  });

  it("vouwt herhalingen uit en slaat EXDATE over", () => {
    const standups = events.filter((e) => e.title === "Standup").map((e) => new Date(e.start).toISOString().slice(0, 10));
    expect(standups).toEqual(["2026-10-12", "2026-10-19"]);
  });

  it("houdt hele dagen als datums en telt ze niet als bezet", () => {
    const vrij = events.find((e) => e.title === "Vrij")!;
    expect(vrij.allDay).toBe(true);
    expect(vrij.startDate).toBe("2026-10-16");
    expect(vrij.endDate).toBe("2026-10-17");
    expect(vrij.busy).toBe(false);
  });
});
