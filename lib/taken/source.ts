import type { Source, Task } from "./types";

// Waar een taak vandaan komt, en de link terug (naar de mail of de gedeelde pagina).

export const SOURCE_LABEL: Record<Source, string> = {
  handmatig: "getypt",
  spraak: "ingesproken",
  doorgestuurd: "doorgestuurde mail",
  "mail-radar": "uit je mail",
  notitie: "uit een notitie",
  snelknop: "snelknop",
  gedeeld: "gedeeld",
};

/** Bronnen van buiten de app; die krijgen een label in de lijst en een filter in de Inbox. */
export const OUTSIDE: Source[] = ["mail-radar", "doorgestuurd", "gedeeld", "snelknop"];
export const isOutside = (source: Source) => OUTSIDE.includes(source);

/** Filtergroepen in de Inbox: mail (radar en doorgestuurd samen), gedeeld, snelknop en de rest. */
export type SourceGroup = "mail" | "gedeeld" | "snelknop" | "app";
export const SOURCE_GROUP_LABEL: Record<SourceGroup, string> = { app: "In de app", mail: "Mail", gedeeld: "Gedeeld", snelknop: "Snelknop" };
export function sourceGroup(source: Source): SourceGroup {
  if (source === "mail-radar" || source === "doorgestuurd") return "mail";
  if (source === "gedeeld" || source === "snelknop") return source;
  return "app";
}

/** De link terug: de mail, anders de eerste link in de notitie van een gedeelde taak. */
export function sourceLink(task: Pick<Task, "source" | "mailLink" | "note">): string | null {
  if (task.mailLink) return task.mailLink;
  if (task.source === "gedeeld" || task.source === "snelknop") return task.note?.match(/https?:\/\/\S+/)?.[0] || null;
  return null;
}
