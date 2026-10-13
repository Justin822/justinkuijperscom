import { amsterdamToday } from "./dates";
import { canReadMail, googleApi, GoogleError } from "./google";
import { mailToTask, type MailKind, type MailMeta } from "./mail";
import { getSettings, isMailSeen, markMailSeen, saveTasks, updateSettings } from "./store";
import type { GoogleLink, MailSettings, Task } from "./types";
import { newTask } from "./validate";

// Mail-radar: mails met het Gmail-label "Planner" (of "Planner/Wachten") worden taken in je Inbox.
// Daarna krijgt de mail het label "Planner/Verwerkt", zodat je in Gmail ziet wat er al in staat.

const GMAIL = "/gmail/v1/users/me";
export const MAIL_LABELS = { taak: "Planner", wachten: "Planner/Wachten", verwerkt: "Planner/Verwerkt" } as const;
const PER_RUN = 25;

export const DEFAULT_MAIL: MailSettings = { enabled: false, labels: null, lastRunAt: null, lastError: null, lastCount: 0 };

async function ensureLabels(link: GoogleLink): Promise<NonNullable<MailSettings["labels"]>> {
  const data = await googleApi<{ labels?: { id: string; name: string }[] }>(link, `${GMAIL}/labels`, "gmail labels");
  const byName = new Map((data.labels || []).map((l) => [l.name.toLowerCase(), l.id]));
  const ids: Record<string, string> = {};
  // In deze volgorde: "Planner" moet bestaan voordat Gmail "Planner/…" kan aanmaken.
  for (const key of ["taak", "wachten", "verwerkt"] as const) {
    const name = MAIL_LABELS[key];
    let id = byName.get(name.toLowerCase());
    if (!id) {
      const created = await googleApi<{ id: string }>(link, `${GMAIL}/labels`, "gmail label maken", {
        method: "POST",
        body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
      });
      id = created.id;
    }
    ids[key] = id;
  }
  return ids as NonNullable<MailSettings["labels"]>;
}

const header = (headers: { name: string; value: string }[] | undefined, name: string) =>
  headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

async function readMeta(link: GoogleLink, id: string): Promise<MailMeta> {
  const params = new URLSearchParams({ format: "metadata" });
  for (const h of ["Subject", "From", "To"]) params.append("metadataHeaders", h);
  const m = await googleApi<any>(link, `${GMAIL}/messages/${encodeURIComponent(id)}?${params}`, "gmail bericht");
  const headers = m.payload?.headers;
  return {
    id,
    threadId: m.threadId || id,
    subject: header(headers, "Subject"),
    from: header(headers, "From"),
    to: header(headers, "To"),
    snippet: decodeEntities(m.snippet || "").slice(0, 500),
    starred: Array.isArray(m.labelIds) && m.labelIds.includes("STARRED"),
  };
}

async function moveToDone(link: GoogleLink, id: string, from: string, done: string) {
  await googleApi(link, `${GMAIL}/messages/${encodeURIComponent(id)}/modify`, "gmail label wisselen", {
    method: "POST",
    body: JSON.stringify({ addLabelIds: [done], removeLabelIds: [from] }),
  });
}

async function collect(link: GoogleLink, labels: NonNullable<MailSettings["labels"]>, today: string): Promise<Task[]> {
  const created: Task[] = [];
  for (const kind of ["taak", "wachten"] as MailKind[]) {
    const labelId = labels[kind];
    const list = await googleApi<{ messages?: { id: string }[] }>(
      link,
      `${GMAIL}/messages?labelIds=${encodeURIComponent(labelId)}&maxResults=${PER_RUN}`,
      "gmail zoeken"
    );
    for (const { id } of list.messages || []) {
      if (!(await isMailSeen(id))) {
        const task = newTask(mailToTask(await readMeta(link, id), kind, today, link.email));
        if (task) {
          await saveTasks([task]);
          created.push(task);
        }
        await markMailSeen(id);
      }
      // Ook als hij al verwerkt was (bijv. het label wisselen mislukte de vorige keer).
      await moveToDone(link, id, labelId, labels.verwerkt);
    }
  }
  return created;
}

/** Eén ronde van de mail-radar. Fouten komen in de instellingen te staan, niet als uitzondering. */
export async function runMailRadar(): Promise<{ created: Task[]; error: string | null }> {
  const settings = await getSettings();
  const link = settings.google;
  const mail = settings.mail || DEFAULT_MAIL;
  if (!mail.enabled || !link || link.needsReconnect || !canReadMail(link)) return { created: [], error: null };

  const save = (change: Partial<MailSettings>) =>
    updateSettings((s) => ({ ...s, mail: { ...DEFAULT_MAIL, ...(s.mail || {}), ...change } }));

  let created: Task[] = [];
  try {
    let labels = mail.labels || (await ensureLabels(link));
    try {
      created = await collect(link, labels, amsterdamToday());
    } catch (error) {
      // Label in Gmail verwijderd of hernoemd: opnieuw opzoeken of aanmaken en nog één keer.
      if (!(error instanceof GoogleError) || ![400, 404].includes(error.status)) throw error;
      labels = await ensureLabels(link);
      created = await collect(link, labels, amsterdamToday());
    }
    await save({ labels, lastRunAt: Date.now(), lastError: null, lastCount: created.length });
    return { created, error: null };
  } catch (error: any) {
    const message = error?.message || "Gmail niet bereikbaar";
    console.error("taken mail-radar", error);
    await save({ lastRunAt: Date.now(), lastError: message, lastCount: created.length }).catch(() => {});
    return { created, error: message };
  }
}
