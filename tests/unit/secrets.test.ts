import { afterEach, describe, expect, it } from "vitest";
import { seal, unseal } from "@/lib/taken/secrets";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("seal/unseal", () => {
  it("versleutelt met TAKEN_SECRET en ontsleutelt weer", () => {
    process.env.TAKEN_SECRET = "geheim";
    const sealed = seal("1//refresh-token");
    expect(sealed).toMatch(/^enc:v1:/);
    expect(sealed).not.toContain("refresh-token");
    expect(unseal(sealed)).toBe("1//refresh-token");
    expect(seal(sealed)).toBe(sealed);
  });

  it("laat waarden ongemoeid zonder TAKEN_SECRET", () => {
    delete process.env.TAKEN_SECRET;
    expect(seal("token")).toBe("token");
    expect(unseal("token")).toBe("token");
  });

  it("geeft null met een ander geheim", () => {
    process.env.TAKEN_SECRET = "a";
    const sealed = seal("token");
    process.env.TAKEN_SECRET = "b";
    expect(unseal(sealed)).toBeNull();
  });
});
