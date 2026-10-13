import { describe, expect, it } from "vitest";
import { sourceGroup, sourceLink } from "@/lib/taken/source";
import { task } from "./helpers";

describe("herkomst", () => {
  it("groepeert mail-bronnen samen", () => {
    expect(sourceGroup("mail-radar")).toBe("mail");
    expect(sourceGroup("doorgestuurd")).toBe("mail");
    expect(sourceGroup("gedeeld")).toBe("gedeeld");
    expect(sourceGroup("spraak")).toBe("app");
  });

  it("vindt de link terug", () => {
    expect(sourceLink(task({ source: "mail-radar", mailLink: "https://mail.google.com/x" }))).toBe("https://mail.google.com/x");
    expect(sourceLink(task({ source: "gedeeld", note: "Lees dit\nhttps://example.com/a b" }))).toBe("https://example.com/a");
    expect(sourceLink(task({ source: "handmatig", note: "https://example.com" }))).toBeNull();
  });
});
