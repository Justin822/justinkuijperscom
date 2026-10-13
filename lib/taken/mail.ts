import { addDays } from "./dates";
import type { Area } from "./config";
import { parseTask } from "./parse";
import type { Task } from "./types";

// Mail-radar zonder AI: van een gelabelde mail een taak maken.
// - label "Planner": een taak voor jou, de onderwerpregel gaat door dezelfde parser als het invoerveld;
// - label "Planner/Wachten": je wacht op antwoord van de ontvanger (status "wachten op", nabellen over 3 dagen).

export type MailKind = "taak" | "wachten";

export type MailMeta = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  starred: boolean;
};

/** "Re: Fwd: Offerte" → "Offerte" (ook Nederlandse en Duitse voorvoegsels). */
export function cleanSubject(subject: string): string {
  let s = subject.trim();
  const prefix = /^(re|fw|fwd|antw|doorst|wg|aw|tr|sv|vs)\s*(\[\d+\])?\s*:\s*/i;
  while (prefix.test(s)) s = s.replace(prefix, "");
  return s.trim();
}

/** "Piet Jansen <piet@x.nl>" → "Piet Jansen"; zonder naam het adres. Bij meerdere ontvangers de eerste. */
export function personName(header: string): string {
  const first = header.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)[0]?.trim() || "";
  const named = first.match(/^"?([^"<]+?)"?\s*<[^>]+>$/);
  if (named) return named[1].trim();
  return first.replace(/[<>]/g, "").trim();
}

/** Link naar de mail in Gmail (het juiste account bij meerdere accounts). */
export function gmailLink(threadId: string, account: string | null): string {
  return `https://mail.google.com/mail/u/${encodeURIComponent(account || "0")}/#all/${encodeURIComponent(threadId)}`;
}

export function mailToTask(mail: MailMeta, kind: MailKind, today: string, account: string | null, areas?: Area[]): Partial<Task> {
  const subject = cleanSubject(mail.subject);
  const { chips, ...parsed } = parseTask(subject, today, areas);
  const from = personName(mail.from);
  const to = personName(mail.to);
  const title = (parsed.title || (kind === "wachten" ? `Antwoord van ${to || "iemand"}` : `Mail van ${from || "onbekend"}`)).slice(0, 300);
  const note = [kind === "wachten" ? `Aan: ${mail.to}` : `Van: ${mail.from}`, mail.snippet].filter(Boolean).join("\n\n").slice(0, 5000);
  const base: Partial<Task> = {
    ...parsed,
    title,
    note,
    source: "mail-radar",
    mailLink: gmailLink(mail.threadId, account),
    impact: mail.starred ? "hoog" : parsed.impact,
  };
  if (kind === "wachten") {
    return { ...base, status: "wachten", waitingOn: (to || parsed.waitingOn || "").slice(0, 120) || null, followUp: parsed.deadline || addDays(today, 3) };
  }
  return base;
}
