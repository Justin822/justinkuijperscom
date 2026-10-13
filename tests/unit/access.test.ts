import { afterEach, describe, expect, it } from "vitest";
import { newSessionId, safeEqual, signSession, verifySession } from "@/lib/taken/access";
import { deviceName } from "@/lib/taken/session";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("sessiecookie", () => {
  it("accepteert alleen een geldige handtekening", async () => {
    process.env.TAKEN_SECRET = "geheim";
    const id = newSessionId();
    const cookie = (await signSession(id))!;
    expect(await verifySession(cookie)).toBe(id);
    expect(await verifySession(`${id}.${"0".repeat(64)}`)).toBeNull();
    expect(await verifySession(`${newSessionId()}.${cookie.split(".")[1]}`)).toBeNull();
    expect(await verifySession("rommel")).toBeNull();
    expect(await verifySession(null)).toBeNull();
  });

  it("maakt cookies ongeldig als het geheim verandert", async () => {
    process.env.TAKEN_SECRET = "oud";
    const cookie = (await signSession(newSessionId()))!;
    process.env.TAKEN_SECRET = "nieuw";
    expect(await verifySession(cookie)).toBeNull();
  });

  it("valt terug op het wachtwoord zonder TAKEN_SECRET", async () => {
    delete process.env.TAKEN_SECRET;
    process.env.TAKEN_PASSWORD = "pw1";
    const cookie = (await signSession(newSessionId()))!;
    process.env.TAKEN_PASSWORD = "pw2";
    expect(await verifySession(cookie)).toBeNull();
  });
});

describe("hulpjes", () => {
  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });

  it("deviceName herkent een Android-telefoon", () => {
    expect(deviceName("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36")).toBe("Chrome op Android");
    expect(deviceName(null)).toBe("Onbekend apparaat");
  });
});
