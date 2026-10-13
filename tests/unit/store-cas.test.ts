import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { task } from "./helpers";

// Een nep-Redis die elk verzoek een willekeurig moment laat duren, zodat gelijktijdige verzoeken door elkaar lopen.
const db = new Map<string, any>();
const pause = () => new Promise((resolve) => setTimeout(resolve, Math.random() * 4));

async function fakeRedis(cmd: string[]): Promise<unknown> {
  await pause();
  const [op, key, ...rest] = cmd;
  const hash = () => (db.get(key) as Map<string, string>) || db.set(key, new Map()).get(key);
  switch (op) {
    case "GET":
      return db.get(key) ?? null;
    case "SET":
      db.set(key, rest[0]);
      return "OK";
    case "MGET":
      return [key, ...rest].map((k) => db.get(k) ?? null);
    case "HGET":
      return hash().get(rest[0]) ?? null;
    case "HSET":
      for (let i = 0; i < rest.length; i += 2) hash().set(rest[i], rest[i + 1]);
      return 1;
    case "HGETALL":
      return Array.from(hash()).flat();
    default:
      throw new Error(`niet nagebootst: ${op}`);
  }
}

// De twee CAS-scripts van de store, atomair nagebootst.
async function fakeEval(script: string, keys: string[], args: string[]): Promise<unknown> {
  await pause();
  if (script.includes("HDEL")) {
    const from = (db.get(keys[0]) as Map<string, string>) || new Map();
    if (from.get(args[0]) !== args[1]) return 0;
    const to = (db.get(keys[1]) as Map<string, string>) || db.set(keys[1], new Map()).get(keys[1]);
    to.set(args[0], args[1]);
    from.delete(args[0]);
    return 1;
  }
  if (script.includes("HGET")) {
    const h = (db.get(keys[0]) as Map<string, string>) || db.set(keys[0], new Map()).get(keys[0]);
    const cur = h.get(args[0]);
    if ((cur === undefined && args[1] === "") || cur === args[1]) {
      h.set(args[0], args[2]);
      return 1;
    }
    return 0;
  }
  const cur = db.get(keys[0]);
  if ((cur === undefined && args[0] === "") || cur === args[0]) {
    db.set(keys[0], args[1]);
    return 1;
  }
  return 0;
}

vi.mock("@/lib/redis", () => ({ hasRedis: true, redis: (cmd: string[]) => fakeRedis(cmd), evalScript: (s: string, k: string[], a: string[]) => fakeEval(s, k, a) }));

let store: typeof import("@/lib/taken/store");
beforeAll(async () => {
  store = await import("@/lib/taken/store");
});

beforeEach(() => db.clear());

describe("compare-and-set in Redis", () => {
  it("verliest geen gelijktijdige wijzigingen aan dezelfde taak", async () => {
    const t = task({ postponed: 0, focusMinutes: 0 });
    await store.saveTasks([t]);
    await Promise.all([
      ...Array.from({ length: 5 }, () => store.mutateTask(t.id, (cur) => cur && { ...cur, postponed: cur.postponed + 1 })),
      ...Array.from({ length: 5 }, () => store.mutateTask(t.id, (cur) => cur && { ...cur, focusMinutes: cur.focusMinutes + 10 })),
    ]);
    const saved = await store.getTask(t.id);
    expect(saved).toMatchObject({ postponed: 5, focusMinutes: 50 });
  });

  it("schrijft niets als de wijziging null teruggeeft", async () => {
    const result = await store.mutateTask("bestaat-niet", (cur) => cur);
    expect(result).toEqual({ value: null, changed: false });
    expect(await store.getTask("bestaat-niet")).toBeNull();
  });

  it("voegt gelijktijdige wijzigingen aan een dagplan samen", async () => {
    const base = { date: "2026-10-13", top3: [], swapped: [], areas: [], closedAt: null };
    await Promise.all(
      ["a", "b", "c", "d"].map((id) =>
        store.mutateDay("2026-10-13", (cur) => {
          const plan = cur || base;
          return { ...plan, swapped: [...plan.swapped, id] };
        })
      )
    );
    expect((await store.getDay("2026-10-13"))?.swapped.sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("instellingen: twee wijzigingen tegelijk blijven allebei staan", async () => {
    await Promise.all([
      store.updateSettings((s) => ({ ...s, workday: { start: "08:00", end: "16:00" } })),
      store.updateSettings((s) => ({ ...s, icsSources: [{ id: "x", name: "Werk", url: "https://example.com/a.ics" }] })),
    ]);
    const s = await store.getSettings();
    expect(s.workday.start).toBe("08:00");
    expect(s.icsSources).toHaveLength(1);
  });
});

describe("archief", () => {
  it("verplaatst alleen taken die langer dan 30 dagen af zijn", async () => {
    const now = Date.parse("2026-10-13T12:00:00Z");
    const old = task({ status: "af", doneAt: now - 40 * 86400000 });
    const recent = task({ status: "af", doneAt: now - 5 * 86400000 });
    const open = task({ status: "gepland" });
    await store.saveTasks([old, recent, open]);
    expect(await store.archiveDoneTasks(now)).toBe(1);
    expect((await store.getTasks()).map((t) => t.id).sort()).toEqual([recent.id, open.id].sort());
    expect((db.get("taken:archive") as Map<string, string>).has(old.id)).toBe(true);
  });
});
