import { describe, expect, it } from "vitest";
import { makePlan, pickTop, rankTasks } from "@/lib/taken/score";
import { task, TODAY } from "./helpers";

describe("rankTasks", () => {
  it("zet een verlopen harde deadline bovenaan, met reden", () => {
    const late = task({ deadline: "2026-10-12", deadlineHard: true });
    const plain = task();
    const ranked = rankTasks([plain, late], TODAY, []);
    expect(ranked[0].task.id).toBe(late.id);
    expect(ranked[0].reason).toMatch(/^Harde deadline was gisteren/);
  });

  it("laat wachten, ooit, af en uitgesloten taken weg", () => {
    const keep = task();
    const tasks = [keep, task({ status: "wachten" }), task({ status: "ooit" }), task({ status: "af" }), task()];
    const ranked = rankTasks(tasks, TODAY, [], [tasks[4].id]);
    expect(ranked.map((s) => s.task.id)).toEqual([keep.id]);
  });

  it("geeft voorrang aan wat voor vandaag gepland staat", () => {
    const planned = task({ planDate: TODAY });
    const later = task({ planDate: "2026-10-20" });
    expect(rankTasks([later, planned], TODAY, [])[0].task.id).toBe(planned.id);
  });
});

describe("pickTop", () => {
  it("neemt maximaal één grote taak", () => {
    const big1 = task({ estimate: 240, impact: "hoog" });
    const big2 = task({ estimate: 480, impact: "hoog" });
    const small = task({ estimate: 15 });
    const picked = pickTop(rankTasks([big1, big2, small], TODAY, []), 3);
    expect(picked.filter((s) => (s.task.estimate || 0) >= 240)).toHaveLength(1);
    expect(picked).toHaveLength(2);
  });
});

describe("makePlan", () => {
  it("kiest drie taken en onthoudt hun gebieden", () => {
    const tasks = [task({ areaId: "appel" }), task({ areaId: "prive" }), task(), task()];
    const plan = makePlan(tasks, TODAY, []);
    expect(plan.top3).toHaveLength(3);
    expect(plan.areas).toHaveLength(3);
    expect(plan.closedAt).toBeNull();
  });
});
