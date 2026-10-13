import os from "os";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { task } from "./helpers";

// De geplande ronde (app/api/taken/cron) met de bestandsopslag; versturen wordt opgevangen.
const sent: { title: string; body: string }[] = [];
vi.mock("@/lib/taken/push", () => ({
  sendPush: async (m: { title: string; body: string }) => {
    sent.push(m);
    return { sent: 1, failed: 0 };
  },
  pushConfigured: () => true,
  pushPublicKey: () => "sleutel",
}));
vi.mock("@/lib/taken/gmail", () => ({ runMailRadar: async () => ({ created: [], error: null }), DEFAULT_MAIL: {} }));

const file = path.join(os.tmpdir(), `planner-cron-test-${process.pid}.json`);
let route: typeof import("@/app/api/taken/cron/route");
let store: typeof import("@/lib/taken/store");

const call = (body?: object, secret = "geheim") =>
  route.POST(
    new Request("http://localhost/api/taken/cron", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    })
  );

beforeAll(async () => {
  process.env.TAKEN_DATA_FILE = file;
  process.env.CRON_SECRET = "geheim";
  delete process.env.KV_REST_API_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.QSTASH_TOKEN;
  vi.useFakeTimers({ toFake: ["Date"] });
  store = await import("@/lib/taken/store");
  route = await import("@/app/api/taken/cron/route");
});

afterAll(() => vi.useRealTimers());

beforeEach(async () => {
  sent.length = 0;
  for (const t of await store.getTasks()) await store.deleteTask(t.id);
  await store.setValue("push:ochtend:2026-10-13", null);
  await store.updateSettings((s) => ({ ...s, push: undefined }));
});

describe("geplande ronde", () => {
  it("weigert zonder het juiste geheim", async () => {
    expect((await call({}, "fout")).status).toBe(401);
  });

  it("stuurt de ochtendmelding één keer per dag, niet 's nachts", async () => {
    await store.saveTasks([task({ title: "Btw", deadline: "2026-10-13", deadlineHard: true, status: "gepland" })]);
    vi.setSystemTime(new Date("2026-10-13T02:00:00Z")); // 04:00 in Nederland
    await call();
    expect(sent).toHaveLength(0);

    vi.setSystemTime(new Date("2026-10-13T05:45:00Z")); // 07:45
    await call();
    expect(sent.map((m) => m.title)).toContain("Harde deadline vandaag");
    const count = sent.length;
    await call();
    expect(sent).toHaveLength(count);
  });

  it("stuurt niets als de ochtendmelding uit staat", async () => {
    await store.updateSettings((s) => ({ ...s, push: { ochtend: false, afsluiten: true, afsluitTijd: "17:30", focus: true } }));
    await store.saveTasks([task({ deadline: "2026-10-13", status: "gepland" })]);
    vi.setSystemTime(new Date("2026-10-13T06:00:00Z"));
    await call();
    expect(sent).toHaveLength(0);
  });

  it("focusmelding alleen als de timer niet is gestopt of opnieuw gestart", async () => {
    await store.setValue("push:focus", JSON.stringify({ id: "f1", endsAt: 0, minutes: 25, title: "Offerte" }));
    await call({ job: "focus", id: "oud" });
    expect(sent).toHaveLength(0);
    await call({ job: "focus", id: "f1" });
    expect(sent).toEqual([expect.objectContaining({ title: "Focus klaar", body: "25 min aan Offerte. Even pauze." })]);
    await call({ job: "focus", id: "f1" });
    expect(sent).toHaveLength(1);
  });

  it("afsluitherinnering vervalt als je intussen een andere tijd koos", async () => {
    await store.saveTasks([task({ planDate: "2026-10-13", status: "gepland" })]);
    await call({ job: "afsluiten", date: "2026-10-13", tijd: "17:00" });
    expect(sent).toHaveLength(0);
    await call({ job: "afsluiten", date: "2026-10-13", tijd: "17:30" });
    expect(sent).toEqual([expect.objectContaining({ title: "Tijd om je dag af te sluiten" })]);
  });
});
