import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/taken/cron";
import { amsterdamToday } from "@/lib/taken/dates";
import { runMailRadar } from "@/lib/taken/gmail";
import { utcToZoned, zonedToUtc } from "@/lib/taken/ics";
import { sendPush } from "@/lib/taken/push";
import { closeReminder, DEFAULT_PUSH, focusDone, morningMessages } from "@/lib/taken/push-messages";
import { scheduleJob } from "@/lib/taken/qstash";
import { fail } from "@/lib/taken/server";
import { getDay, getSettings, getTasks, getValue, setValue } from "@/lib/taken/store";

export const dynamic = "force-dynamic";

const FOCUS_KEY = "push:focus";

// Geplande ronde (zie vercel.json en lib/taken/cron.ts):
// - zonder job (dagelijkse Vercel Cron, of een externe planner): mail-radar, ochtendmelding en de
//   herinnering om af te sluiten inplannen; elk hooguit één keer per dag;
// - { job: "afsluiten" } en { job: "focus" }: door QStash op het juiste moment teruggeroepen.

async function daily() {
  const mail = await runMailRadar();
  const settings = await getSettings();
  const prefs = { ...DEFAULT_PUSH, ...(settings.push || {}) };
  const date = amsterdamToday();
  const hour = Number(utcToZoned(Date.now()).time.slice(0, 2));
  const result: Record<string, unknown> = { mail: { created: mail.created.length, error: mail.error } };

  // Ochtendmelding: niet midden in de nacht, en maar één keer per dag.
  if (prefs.ochtend && hour >= 6 && (await getValue(`push:ochtend:${date}`)) === null) {
    await setValue(`push:ochtend:${date}`, "1");
    const tasks = await getTasks();
    const messages = morningMessages(tasks, await getDay(date), date);
    for (const m of messages) await sendPush(m);
    result.ochtend = messages.length;
  }

  // Herinnering om af te sluiten, op jouw tijd (alleen met QStash; één keer per dag inplannen).
  const at = zonedToUtc(date, prefs.afsluitTijd);
  if (prefs.afsluiten && at > Date.now() && (await getValue(`push:afsluiten:${date}`)) === null) {
    const id = await scheduleJob(at, { job: "afsluiten", date, tijd: prefs.afsluitTijd });
    if (id) await setValue(`push:afsluiten:${date}`, id);
    result.afsluiten = Boolean(id);
  }
  return result;
}

async function job(body: any) {
  if (body.job === "afsluiten") {
    const prefs = { ...DEFAULT_PUSH, ...((await getSettings()).push || {}) };
    // Intussen uitgezet of een andere tijd gekozen: deze herinnering vervalt.
    if (!prefs.afsluiten || prefs.afsluitTijd !== body.tijd) return { skipped: true };
    const message = closeReminder(await getTasks(), await getDay(body.date), body.date);
    return message ? sendPush(message) : { skipped: true };
  }
  if (body.job === "focus") {
    const raw = await getValue(FOCUS_KEY);
    const focus = raw ? JSON.parse(raw) : null;
    const prefs = { ...DEFAULT_PUSH, ...((await getSettings()).push || {}) };
    // Alleen als de timer niet is gestopt of opnieuw gestart.
    if (!focus || focus.id !== body.id || !prefs.focus) return { skipped: true };
    await setValue(FOCUS_KEY, null);
    return sendPush(focusDone(focus.title, focus.minutes));
  }
  return { skipped: true };
}

async function run(request: Request) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  try {
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    return NextResponse.json(body?.job ? await job(body) : await daily());
  } catch (error) {
    return fail("cron", error, "Geplande ronde mislukt.");
  }
}

export const GET = run;
export const POST = run;
