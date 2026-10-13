import os from "os";
import path from "path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mail-radar tegen een nagebootste Gmail-API (geen netwerk), met de bestandsopslag.
const file = path.join(os.tmpdir(), `planner-gmail-test-${process.pid}.json`);

type Message = { id: string; threadId: string; labelIds: string[]; subject: string; from: string; to: string; snippet: string };
let labels: { id: string; name: string }[] = [];
let messages: Message[] = [];
let calls: string[] = [];

function fakeGoogle(url: string, init: RequestInit = {}) {
  const u = new URL(url);
  const method = init.method || "GET";
  calls.push(`${method} ${u.pathname}`);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  if (u.pathname === "/token") return json({ access_token: "toegang", expires_in: 3600 });
  const base = "/gmail/v1/users/me";
  if (u.pathname === `${base}/labels` && method === "GET") return json({ labels });
  if (u.pathname === `${base}/labels` && method === "POST") {
    const { name } = JSON.parse(String(init.body));
    const label = { id: `Label_${labels.length + 1}`, name };
    labels.push(label);
    return json(label);
  }
  if (u.pathname === `${base}/messages` && method === "GET") {
    const label = u.searchParams.get("labelIds")!;
    if (!labels.some((l) => l.id === label)) return json({ error: { message: "Invalid label" } }, 400);
    return json({ messages: messages.filter((m) => m.labelIds.includes(label)).map((m) => ({ id: m.id, threadId: m.threadId })) });
  }
  const one = u.pathname.match(/\/messages\/([^/]+)(\/modify)?$/);
  if (one) {
    const m = messages.find((x) => x.id === decodeURIComponent(one[1]))!;
    if (one[2]) {
      const { addLabelIds, removeLabelIds } = JSON.parse(String(init.body));
      m.labelIds = [...m.labelIds.filter((l) => !removeLabelIds.includes(l)), ...addLabelIds];
      return json({ id: m.id, labelIds: m.labelIds });
    }
    return json({
      id: m.id,
      threadId: m.threadId,
      labelIds: m.labelIds,
      snippet: m.snippet,
      payload: { headers: [{ name: "Subject", value: m.subject }, { name: "From", value: m.from }, { name: "To", value: m.to }] },
    });
  }
  return json({ error: { message: `niet nagebootst: ${method} ${u.pathname}` } }, 500);
}

let store: typeof import("@/lib/taken/store");
let gmail: typeof import("@/lib/taken/gmail");

beforeAll(async () => {
  process.env.TAKEN_DATA_FILE = file;
  process.env.GOOGLE_CLIENT_ID = "id";
  process.env.GOOGLE_CLIENT_SECRET = "geheim";
  delete process.env.KV_REST_API_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => fakeGoogle(url, init)));
  vi.spyOn(console, "log").mockImplementation(() => {});
  store = await import("@/lib/taken/store");
  gmail = await import("@/lib/taken/gmail");
});

beforeEach(async () => {
  labels = [];
  calls = [];
  messages = [];
  await store.updateSettings((s) => ({
    ...s,
    google: {
      refreshToken: "ververs",
      email: "justin@example.com",
      calendars: [],
      plannerCalendarId: null,
      needsReconnect: false,
      scopes: ["https://www.googleapis.com/auth/gmail.modify"],
    },
    mail: { ...gmail.DEFAULT_MAIL, enabled: true },
  }));
  for (const t of await store.getTasks()) await store.deleteTask(t.id);
});

const labelId = (name: string) => labels.find((l) => l.name === name)!.id;

describe("mail-radar", () => {
  it("maakt de labels aan, zet gelabelde mails om in taken en markeert ze als verwerkt", async () => {
    labels = [{ id: "Label_1", name: "Planner" }];
    messages = [
      { id: "m1", threadId: "t1", labelIds: ["Label_1", "STARRED"], subject: "Re: Offerte vrijdag, Appèl", from: "Piet <piet@x.nl>", to: "me", snippet: "Kun je &#39;m sturen?" },
    ];
    const result = await gmail.runMailRadar();
    expect(result.error).toBeNull();
    expect(labels.map((l) => l.name)).toEqual(["Planner", "Planner/Wachten", "Planner/Verwerkt"]);
    expect(result.created).toHaveLength(1);
    expect(result.created[0]).toMatchObject({ title: "Offerte", areaId: "appel", impact: "hoog", source: "mail-radar", status: "inbox" });
    expect(result.created[0].note).toContain("Kun je 'm sturen?");
    expect(messages[0].labelIds).toEqual(["STARRED", labelId("Planner/Verwerkt")]);
    expect((await store.getSettings()).mail).toMatchObject({ lastError: null, lastCount: 1 });
  });

  it("maakt nooit twee keer een taak van dezelfde mail", async () => {
    await gmail.runMailRadar();
    messages = [{ id: "m2", threadId: "t2", labelIds: [labelId("Planner")], subject: "Bellen", from: "a", to: "b", snippet: "" }];
    expect((await gmail.runMailRadar()).created).toHaveLength(1);
    // Het label staat er opnieuw op (bijv. handmatig teruggezet): geen tweede taak, wel weer verwerkt.
    messages[0].labelIds = [labelId("Planner")];
    expect((await gmail.runMailRadar()).created).toHaveLength(0);
    expect(messages[0].labelIds).toEqual([labelId("Planner/Verwerkt")]);
    expect((await store.getTasks()).filter((t) => t.title === "Bellen")).toHaveLength(1);
  });

  it("Planner/Wachten wordt 'wachten op' de ontvanger", async () => {
    await gmail.runMailRadar();
    messages = [{ id: "m3", threadId: "t3", labelIds: [labelId("Planner/Wachten")], subject: "Contract", from: "me", to: "Kees <k@x.nl>", snippet: "" }];
    const { created } = await gmail.runMailRadar();
    expect(created[0]).toMatchObject({ title: "Contract", status: "wachten", waitingOn: "Kees" });
  });

  it("herstelt als een label in Gmail is verwijderd", async () => {
    await gmail.runMailRadar();
    labels = labels.filter((l) => l.name !== "Planner/Wachten");
    const result = await gmail.runMailRadar();
    expect(result.error).toBeNull();
    expect(labels.some((l) => l.name === "Planner/Wachten")).toBe(true);
  });

  it("doet niets als de mail-radar uit staat", async () => {
    await store.updateSettings((s) => ({ ...s, mail: { ...gmail.DEFAULT_MAIL, enabled: false } }));
    calls = [];
    expect(await gmail.runMailRadar()).toEqual({ created: [], error: null });
    expect(calls).toEqual([]);
  });
});
