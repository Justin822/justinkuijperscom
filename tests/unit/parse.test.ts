import { describe, expect, it } from "vitest";
import { parseTask, splitEntries } from "@/lib/taken/parse";
import { TODAY } from "./helpers";

describe("parseTask", () => {
  it("haalt gebied, deadline en tijdsinschatting uit de zin", () => {
    const p = parseTask("Offerte Jansen vrijdag, Appèl, half uur", TODAY);
    expect(p.title).toBe("Offerte Jansen");
    expect(p.areaId).toBe("appel");
    expect(p.deadline).toBe("2026-10-16");
    expect(p.deadlineHard).toBe(false);
    expect(p.estimate).toBe(30);
  });

  it("herkent een harde deadline en hoge impact", () => {
    const p = parseTask("Belastingaangifte uiterlijk 1 november #prive !!", TODAY);
    expect(p.deadline).toBe("2026-11-01");
    expect(p.deadlineHard).toBe(true);
    expect(p.impact).toBe("hoog");
    expect(p.areaId).toBe("prive");
    expect(p.title).toBe("Belastingaangifte");
  });

  it("zet een plandatum met @", () => {
    const p = parseTask("@morgen bellen met Piet", TODAY);
    expect(p.planDate).toBe("2026-10-14");
    expect(p.deadline).toBeNull();
    expect(p.title).toBe("Bellen met Piet");
  });

  it("herkent wachten op iemand", () => {
    const p = parseTask("wachten op Piet", TODAY);
    expect(p.status).toBe("wachten");
    expect(p.waitingOn).toBe("Piet");
    expect(p.title).toBe("Wachten op Piet");
  });

  it("herkent een herhaling en plant de eerste keer", () => {
    const p = parseTask("Vuilnis buiten zetten elke maandag", TODAY);
    expect(p.repeat).toEqual({ every: 1, unit: "week", weekdays: [1] });
    expect(p.planDate).toBe("2026-10-19");
    expect(p.title).toBe("Vuilnis buiten zetten");
  });

  it("herkent ooit/misschien", () => {
    const p = parseTask("ooit Japans leren", TODAY);
    expect(p.status).toBe("ooit");
    expect(p.title).toBe("Japans leren");
  });

  it("houdt een sterk gebiedswoord in de titel", () => {
    const p = parseTask("Felicio nieuwsbrief schrijven 2 uur", TODAY);
    expect(p.areaId).toBe("felicio");
    expect(p.title).toBe("Felicio nieuwsbrief schrijven");
    expect(p.estimate).toBe(120);
  });

  it("ziet 'om 3 uur' niet als tijdsinschatting", () => {
    expect(parseTask("Tandarts bellen om 3 uur", TODAY).estimate).toBeNull();
  });

  it("rekent relatieve datums uit", () => {
    expect(parseTask("Klant mailen over 2 weken", TODAY).deadline).toBe("2026-10-27");
    expect(parseTask("Rapport volgende week dinsdag", TODAY).deadline).toBe("2026-10-20");
    expect(parseTask("Iets overmorgen", TODAY).deadline).toBe("2026-10-15");
  });

  it("schuift een datum die al voorbij is naar volgend jaar", () => {
    expect(parseTask("Factuur 5 januari", TODAY).deadline).toBe("2027-01-05");
    expect(parseTask("Factuur 10 oktober", TODAY).deadline).toBe("2026-10-10");
  });

  it("geeft chips voor wat het herkende", () => {
    const kinds = parseTask("Offerte vrijdag, Appèl, half uur", TODAY).chips.map((c) => c.kind);
    expect(kinds).toEqual(["gebied", "deadline", "tijd"]);
  });
});

describe("splitEntries", () => {
  it("splitst op regels, puntkomma's en 'en daarnaast'", () => {
    expect(splitEntries("a\nb; c en daarnaast d")).toEqual(["a", "b", "c", "d"]);
  });
});
