import { describe, expect, it } from "vitest";
import { cleanSubject, gmailLink, mailToTask, personName, type MailMeta } from "@/lib/taken/mail";
import { TODAY } from "./helpers";

const mail = (fields: Partial<MailMeta> = {}): MailMeta => ({
  id: "m1",
  threadId: "t1",
  subject: "Offerte Jansen",
  from: "Piet Jansen <piet@jansen.nl>",
  to: "Justin <justin@example.com>",
  snippet: "Kun je vrijdag reageren?",
  starred: false,
  ...fields,
});

describe("cleanSubject", () => {
  it("haalt voorvoegsels weg", () => {
    expect(cleanSubject("Re: Fwd: Offerte")).toBe("Offerte");
    expect(cleanSubject("Antw: Doorst: WG: AW: Planning")).toBe("Planning");
    expect(cleanSubject("RE[2]: Factuur")).toBe("Factuur");
    expect(cleanSubject("Report")).toBe("Report");
  });
});

describe("personName", () => {
  it("leest namen en adressen", () => {
    expect(personName("Piet Jansen <piet@jansen.nl>")).toBe("Piet Jansen");
    expect(personName('"Jansen, Piet" <piet@jansen.nl>, Kees <k@x.nl>')).toBe("Jansen, Piet");
    expect(personName("piet@jansen.nl")).toBe("piet@jansen.nl");
  });
});

describe("mailToTask", () => {
  it("maakt een taak met de herkende onderwerpregel en een link naar de mail", () => {
    const t = mailToTask(mail({ subject: "Re: Offerte Jansen vrijdag, Appèl" }), "taak", TODAY, "justin@example.com");
    expect(t).toMatchObject({
      title: "Offerte Jansen",
      areaId: "appel",
      deadline: "2026-10-16",
      source: "mail-radar",
      status: "inbox",
      mailLink: "https://mail.google.com/mail/u/justin%40example.com/#all/t1",
    });
    expect(t.note).toBe("Van: Piet Jansen <piet@jansen.nl>\n\nKun je vrijdag reageren?");
  });

  it("een mail met ster krijgt hoge impact", () => {
    expect(mailToTask(mail({ starred: true }), "taak", TODAY, null).impact).toBe("hoog");
  });

  it("zonder onderwerp: de afzender als titel", () => {
    expect(mailToTask(mail({ subject: "" }), "taak", TODAY, null).title).toBe("Mail van Piet Jansen");
  });

  it("Planner/Wachten: wachten op de ontvanger, nabellen over 3 dagen", () => {
    const t = mailToTask(mail({ to: "Kees de Vries <kees@x.nl>", subject: "Contract" }), "wachten", TODAY, null);
    expect(t).toMatchObject({ title: "Contract", status: "wachten", waitingOn: "Kees de Vries", followUp: "2026-10-16" });
  });
});

describe("gmailLink", () => {
  it("valt terug op het eerste account", () => {
    expect(gmailLink("abc", null)).toBe("https://mail.google.com/mail/u/0/#all/abc");
  });
});
