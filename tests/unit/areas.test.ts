import { describe, expect, it } from "vitest";
import { cleanAreas, DEFAULT_AREAS, type Area } from "@/lib/taken/config";
import { parseTask } from "@/lib/taken/parse";
import { TODAY } from "./helpers";

const mine: Area[] = [
  ...DEFAULT_AREAS,
  { id: "sport", name: "Sport", short: "Sport", color: "#0ea5e9", keywords: ["sport", "gym"], strong: ["hardlopen"] },
  { id: "oud", name: "Oud project", short: "Oud", color: "#999999", keywords: ["oud"], strong: [], archived: true },
];

describe("eigen gebieden in de parser", () => {
  it("herkent trefwoorden van een eigen gebied", () => {
    expect(parseTask("Schema maken morgen, gym", TODAY, mine)).toMatchObject({ title: "Schema maken", areaId: "sport" });
    expect(parseTask("Hardlopen 5 km", TODAY, mine).areaId).toBe("sport");
    expect(parseTask("Iets #sport", TODAY, mine).chips[0]).toEqual({ kind: "gebied", label: "Sport" });
  });

  it("negeert gearchiveerde gebieden", () => {
    expect(parseTask("Opruimen, oud", TODAY, mine).areaId).toBeNull();
  });

  it("zonder eigen lijst: de standaard", () => {
    expect(parseTask("Offerte, Appèl", TODAY).areaId).toBe("appel");
  });
});

describe("cleanAreas", () => {
  it("houdt bestaande id's en maakt nieuwe uit de naam", () => {
    const result = cleanAreas([
      { id: "appel", name: " Appèl ", short: "Appèl", color: "#E4572E", keywords: "Werk, appèl, werk" },
      { name: "Sport & gezondheid", color: "rood" },
      { name: "Sport & gezondheid" },
    ]) as Area[];
    expect(result.map((a) => a.id)).toEqual(["appel", "sport-gezondheid", "sport-gezondheid-2"]);
    expect(result[0]).toMatchObject({ name: "Appèl", color: "#e4572e", keywords: ["werk", "appèl"] });
    expect(result[1]).toMatchObject({ short: "Sport & gezondhe", color: "#737373", keywords: [] });
  });

  it("weigert een lege lijst, lege namen en alles gearchiveerd", () => {
    expect(cleanAreas([])).toBe("Je hebt minstens één gebied nodig.");
    expect(cleanAreas([{ name: "" }])).toBe("Geef elk gebied een naam.");
    expect(cleanAreas([{ name: "A", archived: true }])).toBe("Laat minstens één gebied actief.");
  });
});
