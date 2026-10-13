import { formatLong } from "./dates";
import type { Note } from "./types";

// Hulpjes voor notities: titel = eerste regel, de rest is de tekst.

export const noteTitle = (note: Pick<Note, "body">) => note.body.split("\n")[0].trim() || "Nieuwe notitie";

export const noteRest = (body: string) => body.split("\n").slice(1).join("\n");

export const notePreview = (note: Pick<Note, "body">) =>
  noteRest(note.body)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" · ")
    .slice(0, 160);

export const dailyTitle = (today: string) => {
  const long = formatLong(today);
  return `${long.charAt(0).toUpperCase()}${long.slice(1)} ${today.slice(0, 4)}`;
};

/** Regels "[ ] iets" of "- [ ] iets": nog niet omgezette taken in een notitie. */
export const TASK_LINE = /^(\s*(?:[-*]\s+)?)\[ \]\s+(.+)$/;

export function taskLines(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.match(TASK_LINE)?.[2].trim())
    .filter(Boolean) as string[];
}

/** Markeert de omgezette regels als "[→]" zodat ze niet dubbel worden aangemaakt. */
export const markConverted = (body: string) =>
  body
    .split("\n")
    .map((l) => l.replace(TASK_LINE, (_m, lead, rest) => `${lead}[→] ${rest}`))
    .join("\n");

/** Korte vingerafdruk van een tekst (FNV-1a), om te zien of een notitie elders is gewijzigd. */
export function bodyHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${text.length.toString(36)}-${h.toString(36)}`;
}
