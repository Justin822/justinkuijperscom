import { NextResponse } from "next/server";
import { toCapture, type CaptureInput } from "@/lib/taken/capture";
import { requireToken, respond } from "@/lib/taken/capture-server";
import { amsterdamToday, formatRelative } from "@/lib/taken/dates";
import { fail } from "@/lib/taken/server";
import { saveNote, saveTasks } from "@/lib/taken/store";
import type { Source } from "@/lib/taken/types";
import { newNote, newTask } from "@/lib/taken/validate";

export const dynamic = "force-dynamic";

// Snel invoeren van buiten de app, met een sleutel uit Instellingen → Snel invoeren.
// POST met JSON ({ text, title?, url?, note?, source? }), een formulier of platte tekst.

async function readInput(request: Request): Promise<CaptureInput & { source?: string }> {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return (await request.json().catch(() => ({}))) || {};
  if (type.includes("form")) {
    const form = await request.formData().catch(() => null);
    const get = (k: string) => (typeof form?.get(k) === "string" ? (form?.get(k) as string) : undefined);
    return { text: get("text"), title: get("title"), url: get("url"), note: get("note"), source: get("source") };
  }
  return { text: await request.text().catch(() => "") };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

export async function POST(request: Request) {
  try {
    const auth = await requireToken(request);
    if (auth instanceof NextResponse) return auth;

    const raw = await readInput(request);
    const input: CaptureInput = { text: str(raw.text, 5000), title: str(raw.title, 300), url: str(raw.url, 2000), note: str(raw.note, 5000) };
    const source: Source = raw.source === "gedeeld" ? "gedeeld" : "snelknop";
    const today = amsterdamToday();
    const capture = toCapture(input, today, source);

    if (capture.kind === "leeg") return respond(request, { error: "Er stond niets in." }, "Er stond niets in.", 400);

    if (capture.kind === "notitie") {
      const note = newNote({ body: capture.body });
      await saveNote(note);
      return respond(request, { note: { id: note.id } }, "✓ Notitie bewaard");
    }

    const now = Date.now();
    const tasks = capture.tasks.map((t, i) => newTask(t, now + i)).filter(Boolean) as NonNullable<ReturnType<typeof newTask>>[];
    await saveTasks(tasks);
    const describe = (t: (typeof tasks)[number]) => {
      const when = t.planDate || t.deadline;
      return when ? `${t.title} (${formatRelative(when, today)})` : t.title;
    };
    const text = tasks.length === 1 ? `✓ ${describe(tasks[0])}` : `✓ ${tasks.length} taken in je Inbox`;
    return respond(request, { tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status })) }, text, 201);
  } catch (error) {
    return fail("capture POST", error, "Kon het niet opslaan.");
  }
}
