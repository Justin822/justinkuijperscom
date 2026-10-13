import type { Area } from "./config";
import { parseTask, splitEntries } from "./parse";
import type { Source, Task } from "./types";

// Snel invoeren van buiten de app (snelknop op je telefoon, deelmenu, mail):
// gewone tekst gaat door dezelfde parser als het invoerveld in de app.

export type CaptureInput = { text?: string; title?: string; url?: string; note?: string };

export type Capture =
  | { kind: "taken"; tasks: Partial<Task>[] }
  | { kind: "notitie"; body: string }
  | { kind: "leeg" };

const URL_RE = /https?:\/\/\S+/i;

/**
 * Van binnenkomende tekst naar taken of een notitie.
 * - "notitie: …" (of "note: …") wordt een notitie.
 * - Een gedeelde link komt in de notitie van de taak; de paginatitel (of de link) wordt de titel.
 * - Meerdere regels worden meerdere taken.
 */
export function toCapture(input: CaptureInput, today: string, source: Source, areas?: Area[]): Capture {
  const text = (input.text || "").trim();
  const title = (input.title || "").trim();
  const url = (input.url || "").trim() || text.match(URL_RE)?.[0] || "";
  const extraNote = (input.note || "").trim();

  const noteMatch = text.match(/^(?:notitie|note)\s*:\s*([\s\S]+)$/i);
  if (noteMatch) return { kind: "notitie", body: noteMatch[1].trim() };

  // Gedeeld uit een app: tekst zonder de link, anders de paginatitel, anders de link zelf.
  const withoutUrl = url ? text.replace(url, "").trim() : text;
  const lines = splitEntries(withoutUrl || title || url).slice(0, 20);
  const tasks: Partial<Task>[] = [];
  for (const line of lines) {
    const { chips, ...fields } = parseTask(line, today, areas);
    if (!fields.title) continue;
    const note = [url && lines.length === 1 ? url : "", extraNote].filter(Boolean).join("\n\n") || null;
    tasks.push({ ...fields, title: fields.title.slice(0, 300), note, source });
  }
  return tasks.length ? { kind: "taken", tasks } : { kind: "leeg" };
}
