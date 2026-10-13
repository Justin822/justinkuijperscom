import { describe, expect, it } from "vitest";
import { closeReminder, morningMessages } from "@/lib/taken/push-messages";
import type { DayPlan } from "@/lib/taken/types";
import { task, TODAY } from "./helpers";

const plan = (ids: string[], fields: Partial<DayPlan> = {}): DayPlan => ({
  date: TODAY,
  top3: ids.map((id) => ({ id, reason: "" })),
  swapped: [],
  areas: [],
  closedAt: null,
  ...fields,
});

describe("morningMessages", () => {
  it("noemt de open top 3, met tijd als die is ingepland", () => {
    const a = task({ title: "Offerte", blockStart: `${TODAY}T09:30` });
    const b = task({ title: "Bellen" });
    const done = task({ title: "Klaar", status: "af" });
    const [first] = morningMessages([a, b, done], plan([a.id, b.id, done.id]), TODAY);
    expect(first).toMatchObject({ title: "Je top 3 voor vandaag", body: "1. Offerte (09:30)\n2. Bellen", url: "/app" });
  });

  it("geeft per deadline een melding met afvinken en naar morgen", () => {
    const hard = task({ title: "Btw", deadline: TODAY, deadlineHard: true });
    const late = task({ title: "Factuur", deadline: "2026-10-10" });
    const later = task({ title: "Later", deadline: "2026-10-20" });
    const msgs = morningMessages([late, hard, later], null, TODAY);
    expect(msgs.map((m) => m.title)).toEqual(["Harde deadline vandaag", "Deadline verlopen"]);
    expect(msgs[0]).toMatchObject({ taskId: hard.id, actions: [{ action: "af" }, { action: "morgen" }] });
  });

  it("herinnert aan nabellen", () => {
    const w = task({ title: "Contract", status: "wachten", waitingOn: "Kees", followUp: TODAY });
    expect(morningMessages([w], null, TODAY)).toMatchObject([{ title: "Nabellen: Kees", body: "Contract" }]);
  });

  it("stuurt niets als er niets te melden is", () => {
    expect(morningMessages([task()], null, TODAY)).toEqual([]);
  });
});

describe("closeReminder", () => {
  it("telt wat nog open staat en zwijgt na afsluiten", () => {
    const a = task({ planDate: TODAY });
    expect(closeReminder([a], plan([]), TODAY)?.body).toBe("1 taak staat nog open voor vandaag.");
    expect(closeReminder([a], plan([], { closedAt: 1 }), TODAY)).toBeNull();
  });
});
