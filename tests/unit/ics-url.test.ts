import { describe, expect, it } from "vitest";
import { isPublicHttpsUrl, normalizeIcsUrl } from "@/lib/taken/agenda-server";

describe("isPublicHttpsUrl", () => {
  it("accepteert gewone agenda-links", () => {
    expect(isPublicHttpsUrl("https://outlook.office365.com/owa/calendar/abc/calendar.ics")).toBe(true);
    expect(isPublicHttpsUrl(normalizeIcsUrl("webcal://p01-caldav.icloud.com/published/2/abc"))).toBe(true);
  });

  it("weigert http, localhost en interne adressen", () => {
    for (const url of [
      "http://example.com/a.ics",
      "https://localhost/a.ics",
      "https://127.0.0.1/a.ics",
      "https://10.0.0.5/a.ics",
      "https://192.168.1.1/a.ics",
      "https://172.20.0.1/a.ics",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/a.ics",
      "https://[fd00::1]/a.ics",
      "https://intranet/a.ics",
      "https://user:pw@example.com/a.ics",
      "geen link",
    ]) {
      expect(isPublicHttpsUrl(url), url).toBe(false);
    }
  });
});
