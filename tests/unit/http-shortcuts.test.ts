import { describe, expect, it } from "vitest";
import { httpShortcutsExport } from "@/lib/taken/http-shortcuts";

// Dezelfde regels als ImportExportBase.validate() en de importer van HTTP Shortcuts.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUIRED = ["executionType", "name", "method", "url", "timeout", "requestBodyType"];

describe("httpShortcutsExport", () => {
  const data = httpShortcutsExport("https://justinkuijpers.com/", "pl_abc");
  const shortcuts = data.categories.flatMap((c) => c.shortcuts);

  it("heeft een geldige versie en unieke uuid's", () => {
    expect(data.version).toBeGreaterThan(0);
    const ids = [...data.categories.map((c) => c.id), ...shortcuts.map((s) => s.id), ...data.variables.map((v) => v.id)];
    for (const id of ids) expect(id).toMatch(UUID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("vult alle velden die de importer verplicht stelt", () => {
    for (const s of shortcuts) {
      for (const key of REQUIRED) expect((s as any)[key], `${s.name}.${key}`).toBeTruthy();
      expect(s.timeout).toBeGreaterThanOrEqual(250);
    }
    for (const v of data.variables) expect(v.key).toMatch(/^[A-Za-z0-9_]{1,30}$/);
  });

  it("stuurt de sleutel als bearer en de tekst als variabele", () => {
    const add = shortcuts.find((s) => s.name === "Zet in Planner") as (typeof shortcuts)[number] & { bodyContent: string };
    expect(add.url).toBe("https://justinkuijpers.com/api/taken/capture?format=text");
    expect(add).toMatchObject({ authentication: "bearer", authToken: "pl_abc", contentType: "text/plain" });
    expect(add.bodyContent).toBe(`{{${data.variables[0].id}}}`);
    expect(data.variables[0].isShareText).toBe(true);
  });
});
