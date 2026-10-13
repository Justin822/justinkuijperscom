import { describe, expect, it } from "vitest";
import { findToken, hashToken, makeToken, toCapture } from "@/lib/taken/capture";
import { TODAY } from "./helpers";

describe("toCapture", () => {
  it("parset tekst net als het invoerveld", () => {
    const c = toCapture({ text: "Offerte Jansen vrijdag, Appèl, half uur" }, TODAY, "snelknop");
    expect(c).toMatchObject({ kind: "taken", tasks: [{ title: "Offerte Jansen", areaId: "appel", deadline: "2026-10-16", estimate: 30, source: "snelknop" }] });
  });

  it("maakt van meerdere regels meerdere taken", () => {
    const c = toCapture({ text: "Bellen met Piet\nBoodschappen" }, TODAY, "snelknop");
    expect(c.kind === "taken" && c.tasks.map((t) => t.title)).toEqual(["Bellen met Piet", "Boodschappen"]);
  });

  it("zet een gedeelde link in de notitie en gebruikt de paginatitel", () => {
    const c = toCapture({ title: "Artikel over SEO", text: "https://example.com/seo" }, TODAY, "gedeeld");
    expect(c).toMatchObject({ kind: "taken", tasks: [{ title: "Artikel over SEO", note: "https://example.com/seo" }] });
  });

  it("gebruikt tekst rond een link als titel", () => {
    const c = toCapture({ text: "Lezen morgen https://example.com/x" }, TODAY, "gedeeld");
    expect(c).toMatchObject({ kind: "taken", tasks: [{ title: "Lezen", deadline: "2026-10-14", note: "https://example.com/x" }] });
  });

  it("maakt een notitie met 'notitie:'", () => {
    expect(toCapture({ text: "Notitie: idee voor Felicio" }, TODAY, "snelknop")).toEqual({ kind: "notitie", body: "idee voor Felicio" });
  });

  it("geeft leeg bij lege invoer", () => {
    expect(toCapture({ text: "   " }, TODAY, "snelknop")).toEqual({ kind: "leeg" });
  });
});

describe("tokens", () => {
  it("vindt alleen het juiste token", () => {
    const token = makeToken();
    const stored = [{ id: "a", name: "Telefoon", hash: hashToken(token), createdAt: 0, lastUsedAt: null }];
    expect(findToken(stored, token)?.id).toBe("a");
    expect(findToken(stored, makeToken())).toBeNull();
    expect(findToken(stored, null)).toBeNull();
    expect(findToken(stored, "zonder-prefix")).toBeNull();
  });
});
