import os from "os";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";

// De bestandsopslag (lokaal en in de e2e-tests): gelijktijdig lezen en schrijven mag nooit een lege stand geven.
const file = path.join(os.tmpdir(), `planner-store-test-${process.pid}.json`);
let store: typeof import("@/lib/taken/store");

beforeAll(async () => {
  process.env.TAKEN_DATA_FILE = file;
  delete process.env.KV_REST_API_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  store = await import("@/lib/taken/store");
});

describe("bestandsopslag", () => {
  it("leest tijdens het schrijven nooit een half bestand", async () => {
    await store.saveSession({ id: "vast", createdAt: 1, lastSeenAt: 1, device: "test" });
    let writing = true;
    const writes = (async () => {
      for (let i = 0; i < 30; i++) await store.saveSession({ id: `s${i}`, createdAt: i, lastSeenAt: i, device: "x".repeat(200000) });
      writing = false;
    })();
    const misses: number[] = [];
    let reads = 0;
    while (writing) {
      if ((await store.getSession("vast"))?.id !== "vast") misses.push(reads);
      reads++;
    }
    await writes;
    expect(reads).toBeGreaterThan(10);
    expect(misses).toEqual([]);
  });
});
