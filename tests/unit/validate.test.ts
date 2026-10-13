import { describe, expect, it } from "vitest";
import { applyPatch, cleanNote, cleanPatch, newNote, newTask } from "@/lib/taken/validate";
import { task } from "./helpers";

describe("cleanPatch", () => {
  it("laat onbekende en ongeldige velden vallen", () => {
    // Gebieden zijn aan te passen: alleen de vorm van het id telt, niet of het in de standaardlijst staat.
    const patch = cleanPatch({ title: "  Hoi  ", evil: 1, deadline: "morgen", estimate: 99999, areaId: "Geen Id!", status: "kapot" });
    expect(patch).toEqual({ title: "Hoi", deadline: null, estimate: null, areaId: null });
  });

  it("accepteert alleen http(s)-links en geldige timeblocks", () => {
    expect(cleanPatch({ mailLink: "javascript:alert(1)" }).mailLink).toBeNull();
    expect(cleanPatch({ mailLink: "https://mail.google.com/x" }).mailLink).toBe("https://mail.google.com/x");
    expect(cleanPatch({ blockStart: "2026-10-13T09:30" }).blockStart).toBe("2026-10-13T09:30");
    expect(cleanPatch({ blockStart: "2026-13-13T09:30" }).blockStart).toBeNull();
  });

  it("schoont herhalingen op", () => {
    expect(cleanPatch({ repeat: { every: 0, unit: "week", weekdays: [5, 1, 1, 9] } }).repeat).toEqual({ every: 1, unit: "week", weekdays: [1, 5] });
    expect(cleanPatch({ repeat: { unit: "jaar" } }).repeat).toBeNull();
  });
});

describe("gebied", () => {
  it("accepteert een eigen gebied-id en weigert rommel", () => {
    expect(cleanPatch({ areaId: "sport" }).areaId).toBe("sport");
    expect(cleanPatch({ areaId: "<script>" }).areaId).toBeNull();
    expect(cleanPatch({ areaId: null }).areaId).toBeNull();
  });
});

describe("applyPatch", () => {
  it("houdt doneAt bij", () => {
    const done = applyPatch(task(), { status: "af" }, 500);
    expect(done.doneAt).toBe(500);
    expect(done.updatedAt).toBe(500);
    expect(applyPatch(done, { status: "gepland" }, 600).doneAt).toBeNull();
  });
});

describe("newTask", () => {
  it("vereist een titel", () => {
    expect(newTask({})).toBeNull();
    const t = newTask({ title: "Iets", status: "gepland" }, 1000)!;
    expect(t.status).toBe("gepland");
    expect(t.createdAt).toBe(1000);
  });
});

describe("cleanNote", () => {
  it("houdt alleen geldige velden", () => {
    expect(cleanNote({ body: "x", pinned: 1, areaId: "cliq", foo: 1 })).toEqual({ body: "x", pinned: true, areaId: "cliq" });
  });
});

describe("clientId", () => {
  it("neemt een geldig id van de browser over", () => {
    expect(newTask({ title: "x", id: "mgq1abc-x7k2p9" })!.id).toBe("mgq1abc-x7k2p9");
    expect(newTask({ title: "x", id: "../../etc" })!.id).not.toBe("../../etc");
    expect(newNote({ id: "mgq1abc-x7k2p9" }).id).toBe("mgq1abc-x7k2p9");
  });
});
