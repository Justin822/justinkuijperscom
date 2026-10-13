import { describe, expect, it } from "vitest";
import { closeDay } from "@/lib/taken/close";
import type { DayPlan } from "@/lib/taken/types";
import { task, TODAY } from "./helpers";

const plan = (fields: Partial<DayPlan> = {}): DayPlan => ({ date: TODAY, top3: [], swapped: [], areas: [], closedAt: null, ...fields });

describe("closeDay", () => {
  it("schuift door naar morgen en telt één keer", () => {
    const t = task({ planDate: TODAY });
    const { changed, plan: closed } = closeDay([t], plan(), TODAY, [t.id], 100);
    expect(changed[0]).toMatchObject({ planDate: "2026-10-14", postponed: 1 });
    expect(closed.closedAt).toBe(100);
    expect(closed.postponed).toEqual([t.id]);
  });

  it("schuift bij nogmaals afsluiten niet opnieuw door", () => {
    const t = task({ postponed: 0 });
    const first = closeDay([t], plan(), TODAY, [t.id], 100);
    const again = closeDay(first.changed, first.plan, TODAY, [t.id], 200);
    expect(again.changed).toEqual([]);
    expect(again.plan.postponed).toEqual([t.id]);
  });

  it("haalt een timeblock van vandaag weg, maar niet een van later", () => {
    const today = task({ planDate: TODAY, blockStart: `${TODAY}T10:00` });
    const later = task({ planDate: "2026-10-20", blockStart: "2026-10-20T10:00" });
    const { changed } = closeDay([today, later], plan(), TODAY, [today.id, later.id]);
    expect(changed.find((t) => t.id === today.id)?.blockStart).toBeNull();
    expect(changed.find((t) => t.id === later.id)?.blockStart).toBe("2026-10-20T10:00");
  });

  it("slaat afgevinkte taken over en telt de inbox", () => {
    const done = task({ status: "af" });
    const inbox = task({ status: "inbox" });
    const { changed, plan: closed } = closeDay([done, inbox], null, TODAY, [done.id]);
    expect(changed).toEqual([]);
    expect(closed.inboxAtClose).toBe(1);
    expect(closed.date).toBe(TODAY);
  });
});
