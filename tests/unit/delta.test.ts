import { describe, expect, it } from "vitest";
import { applyDelta, makeDelta } from "@/lib/taken/delta";

const rec = (id: string, updatedAt: number, v = "") => ({ id, updatedAt, v });

describe("delta-sync", () => {
  it("stuurt alleen wat na 'since' veranderde, plus alle id's", () => {
    const d = makeDelta([rec("a", 1), rec("b", 5), rec("c", 9)], 4, 10);
    expect(d).toEqual({ items: [rec("b", 5), rec("c", 9)], ids: ["a", "b", "c"], now: 10 });
    expect(makeDelta([rec("a", 1)], null, 10)).toEqual({ items: [rec("a", 1)], now: 10 });
  });

  it("past wijzigingen, nieuwe en verwijderde records toe", () => {
    const list = [rec("a", 1, "oud"), rec("b", 1), rec("weg", 1)];
    const next = applyDelta(list, { items: [rec("a", 5, "nieuw"), rec("c", 6)], ids: ["a", "b", "c"], now: 7 });
    expect(next).toEqual([rec("a", 5, "nieuw"), rec("b", 1), rec("c", 6)]);
  });

  it("zonder id's: de hele lijst vervangen", () => {
    expect(applyDelta([rec("x", 1)], { items: [rec("y", 2)], now: 3 })).toEqual([rec("y", 2)]);
  });
});
