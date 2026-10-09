import { AREAS, estimateLabel } from "./config";
import { addDays, formatRelative, makeDate, MONTHS, nextWeekday, weekday, WEEKDAYS } from "./dates";
import type { AreaId, Impact, Status } from "./types";

// Regelgebaseerde parser voor Nederlandse invoer, zonder AI.
// "Offerte Jansen vrijdag, Appèl, half uur" → titel, gebied, deadline en tijdsinschatting.
// Herkende stukjes gaan uit de titel en komen terug als chips.

export type Chip = { kind: "gebied" | "deadline" | "plan" | "tijd" | "impact" | "status"; label: string };

export type Parsed = {
  title: string;
  areaId: AreaId | null;
  project: string | null;
  deadline: string | null;
  deadlineHard: boolean;
  planDate: string | null;
  estimate: number | null;
  impact: Impact | null;
  status: Status;
  waitingOn: string | null;
  chips: Chip[];
};

// Woordgrenzen zonder lookbehind (oudere Safari-versies kennen die niet).
const START = "(?<lead>^|[\\s,;:(])";
const END = "(?=$|[\\s,;:.!?)])";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NUMBER_WORDS: Record<string, number> = { een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6 };
const toNumber = (s: string) => NUMBER_WORDS[s.toLowerCase()] ?? parseFloat(s.replace(",", "."));

const WEEKDAY_RE = WEEKDAYS.join("|");
const MONTH_RE = MONTHS.map((m) => `${m}|${m.slice(0, 3)}`).join("|") + "|sept";
const monthIndex = (name: string) => MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3))) + 1;

/** Zaterdag/zondag: deze zondag, anders deze vrijdag. */
const endOfWeek = (today: string) => (weekday(today) === 6 || weekday(today) === 0 ? nextWeekday(today, 0) : nextWeekday(today, 5));
const nextMonday = (today: string) => nextWeekday(addDays(today, 1), 1);

function withYear(today: string, month: number, day: number, year?: string): string | null {
  if (year) {
    const y = Number(year.length === 2 ? `20${year}` : year);
    return makeDate(y, month, day);
  }
  const thisYear = Number(today.slice(0, 4));
  const date = makeDate(thisYear, month, day);
  // Een datum die ruim voorbij is, bedoelt volgend jaar.
  if (date && date < addDays(today, -7)) return makeDate(thisYear + 1, month, day);
  return date;
}

type DatePattern = { re: string; resolve: (g: Record<string, string>, today: string) => string | null };

// Volgorde telt: langste en meest specifieke eerst.
const DATE_PATTERNS: DatePattern[] = [
  {
    re: `over (?<n>\\d+|een|één|twee|drie|vier|vijf|zes) (?<unit>dagen|dag|weken|week)`,
    resolve: (g, today) => addDays(today, toNumber(g.n) * (g.unit.startsWith("w") ? 7 : 1)),
  },
  {
    re: `volgende week (?<wd>${WEEKDAY_RE})`,
    resolve: (g, today) => nextWeekday(nextMonday(today), WEEKDAYS.indexOf(g.wd.toLowerCase())),
  },
  {
    re: `(?:eind(?:e)? (?:van )?)?volgende week`,
    resolve: (_g, today) => addDays(nextMonday(today), 4),
  },
  {
    re: `(?:eind(?:e)? (?:van )?(?:de|deze) week|deze week)`,
    resolve: (_g, today) => endOfWeek(today),
  },
  {
    re: `(?:eind(?:e)? (?:van )?(?:de|deze) maand|deze maand)`,
    resolve: (_g, today) => {
      const [y, m] = today.split("-").map(Number);
      return addDays(makeDate(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) as string, -1);
    },
  },
  {
    re: `(?:(?:${WEEKDAY_RE}|ma|di|wo|do|vr|za|zo)\\.? )?(?<d>\\d{1,2}) (?<mon>${MONTH_RE})\\.?(?: (?<y>\\d{4}))?`,
    resolve: (g, today) => withYear(today, monthIndex(g.mon), Number(g.d), g.y),
  },
  {
    re: `(?<d>\\d{1,2})[-/](?<m>\\d{1,2})(?:[-/](?<y>\\d{4}|\\d{2}))?(?!\\s*(?:u|uur|min|minuten)${END})`,
    resolve: (g, today) => withYear(today, Number(g.m), Number(g.d), g.y),
  },
  { re: `(?:vandaag|vanavond|vanmiddag|vanochtend)`, resolve: (_g, today) => today },
  { re: `overmorgen`, resolve: (_g, today) => addDays(today, 2) },
  { re: `morgen(?:ochtend|middag|avond)?`, resolve: (_g, today) => addDays(today, 1) },
  {
    // "vrijdag" op een vrijdag is volgende week vrijdag; voor vandaag zeg je "vandaag".
    re: `(?:a\\.s\\. )?(?:volgende )?(?<wd>${WEEKDAY_RE})(?: a\\.s\\.)?`,
    resolve: (g, today) => nextWeekday(addDays(today, 1), WEEKDAYS.indexOf(g.wd.toLowerCase())),
  },
];

const HARD_PREFIXES = ["uiterlijk", "deadline", "vóór", "voor", "uiterlijk op", "deadline op"];

type Estimate = { re: string; minutes: (g: Record<string, string>) => number | null };

const ESTIMATE_PATTERNS: Estimate[] = [
  { re: `anderhalf uur`, minutes: () => 90 },
  { re: `drie kwartier`, minutes: () => 45 },
  { re: `(?:een )?half(?:e)? ?uur(?:tje)?`, minutes: () => 30 },
  { re: `(?:een )?kwartier(?:tje)?`, minutes: () => 15 },
  { re: `(?:een )?halve (?:dag|middag|ochtend)`, minutes: () => 240 },
  { re: `(?:een )?hele dag|een dag werk|dagje`, minutes: () => 480 },
  {
    re: `(?<n>\\d+(?:[.,]\\d+)?|een|één|twee|drie|vier|vijf|zes)\\s*(?:minuten|minuut|min|m)`,
    minutes: (g) => Math.round(toNumber(g.n)),
  },
  {
    re: `(?<om>om )?(?<n>\\d+(?:[.,]\\d+)?|een|één|twee|drie|vier|vijf|zes)\\s*(?:uren|uur|u|h)`,
    // "om 3 uur" is een tijdstip, geen inschatting.
    minutes: (g) => (g.om ? null : Math.round(toNumber(g.n) * 60)),
  },
];

function matchKeyword(value: string): { areaId: AreaId; project: string | null } | null {
  const lower = value.trim().toLowerCase();
  for (const area of AREAS) {
    for (const kw of area.keywords) {
      if (lower === kw) return { areaId: area.id, project: null };
      const m = lower.match(new RegExp(`^${esc(kw)}\\s*/\\s*(.+)$`, "u"));
      if (m) {
        const trimmed = value.trim();
        return { areaId: area.id, project: trimmed.slice(trimmed.indexOf("/") + 1).trim() || null };
      }
    }
  }
  return null;
}

const IMPACT_TAGS: Record<string, Impact> = {
  hoog: "hoog",
  middel: "middel",
  laag: "laag",
  urgent: "hoog",
  prio: "hoog",
  belangrijk: "hoog",
};

/** Splitst een invoer met meerdere taken ("… en daarnaast …", nieuwe regels). */
export function splitEntries(text: string): string[] {
  return text
    .split(/\n|;|(?:,?\s+)(?:en daarnaast|daarnaast|en verder|en ook nog)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseTask(input: string, today: string): Parsed {
  const result: Parsed = {
    title: "",
    areaId: null,
    project: null,
    deadline: null,
    deadlineHard: false,
    planDate: null,
    estimate: null,
    impact: null,
    status: "inbox",
    waitingOn: null,
    chips: [],
  };

  let s = ` ${input.replace(/\s+/g, " ").trim()} `;

  const take = (re: RegExp, handle: (g: Record<string, string>, whole: string) => boolean) => {
    s = s.replace(re, (...args) => {
      const groups: Record<string, string> = args[args.length - 1] || {};
      const whole = args[0] as string;
      return handle(groups, whole) ? `${groups.lead ?? ""} ` : whole;
    });
  };

  // 1. #tags: #appel, #appel/leadgeneratie, #hoog, #ooit, #wachten, #bezig
  take(new RegExp(`${START}#(?<tag>[^\\s,;]+)`, "giu"), (g) => {
    const tag = g.tag.toLowerCase();
    const area = matchKeyword(g.tag);
    if (area && !result.areaId) {
      Object.assign(result, area);
      return true;
    }
    if (IMPACT_TAGS[tag]) {
      result.impact = IMPACT_TAGS[tag];
      return true;
    }
    if (tag === "ooit" || tag === "misschien") {
      result.status = "ooit";
      return true;
    }
    if (tag === "bezig") {
      result.status = "bezig";
      return true;
    }
    if (tag === "wachten") {
      result.status = "wachten";
      return true;
    }
    return false;
  });

  // 2. Uitroeptekens: "!!" is hoge impact, een losse "!" maakt de deadline hard.
  let bang = false;
  take(new RegExp(`(?<lead>)!{2,}`, "gu"), () => {
    result.impact = "hoog";
    return true;
  });
  take(new RegExp(`(?<lead>)!(?=\\s*$)`, "u"), () => {
    bang = true;
    return true;
  });

  // 3. Losse stukjes tussen komma's: ", Appèl," ", Appèl / Leadgeneratie," ", belangrijk,"
  s = s
    .split(",")
    .filter((segment) => {
      const area = matchKeyword(segment);
      if (area && !result.areaId) {
        Object.assign(result, area);
        return false;
      }
      const lower = segment.trim().toLowerCase();
      if (["belangrijk", "heel belangrijk", "urgent", "prio", "hoge prio", "hoge impact"].includes(lower)) {
        result.impact = "hoog";
        return false;
      }
      if (["niet belangrijk", "lage prio", "lage impact"].includes(lower)) {
        result.impact = "laag";
        return false;
      }
      return true;
    })
    .join(",");

  // 4. Plandatum: "@morgen", "@vrijdag"
  for (const p of DATE_PATTERNS) {
    if (result.planDate) break;
    take(new RegExp(`${START}@${p.re}${END}`, "iu"), (g) => {
      const date = p.resolve(g, today);
      if (!date) return false;
      result.planDate = date;
      return true;
    });
  }

  // 5. Deadline, met optioneel "uiterlijk", "deadline", "voor", "op".
  const prefix = `(?:(?<pre>uiterlijk op|deadline op|uiterlijk|deadline|vóór|voor|op|tegen)\\s+)?`;
  for (const p of DATE_PATTERNS) {
    if (result.deadline) break;
    take(new RegExp(`${START}${prefix}${p.re}${END}`, "iu"), (g) => {
      const date = p.resolve(g, today);
      if (!date) return false;
      result.deadline = date;
      result.deadlineHard = Boolean(g.pre && HARD_PREFIXES.includes(g.pre.toLowerCase()));
      return true;
    });
  }
  if (bang) {
    if (result.deadline) result.deadlineHard = true;
    else result.impact = "hoog";
  }

  // 6. Tijdsinschatting
  for (const e of ESTIMATE_PATTERNS) {
    if (result.estimate) break;
    take(new RegExp(`${START}(?:(?:ongeveer|zo'n|ca\\.?|max(?:imaal)?)\\s+)?${e.re}${END}`, "iu"), (g) => {
      const minutes = e.minutes(g);
      if (!minutes || minutes <= 0 || minutes > 600) return false;
      result.estimate = minutes;
      return true;
    });
  }

  // 7. Impactwoorden midden in de zin
  take(new RegExp(`${START}(?:heel belangrijk|hoge prio|urgent)${END}`, "iu"), () => {
    result.impact = "hoog";
    return true;
  });

  // 8. Ooit / misschien
  take(new RegExp(`${START}(?:misschien ooit|ooit eens|ooit|someday)${END}`, "iu"), () => {
    result.status = "ooit";
    return true;
  });

  // 9. "wachten op Piet" (tot de volgende komma)
  take(new RegExp(`${START}(?:wacht(?:en)? op|wachtend op)\\s+(?<who>[^,;:]+)`, "iu"), (g) => {
    result.status = "wachten";
    result.waitingOn = g.who.trim().replace(/[.!?]+$/, "");
    return true;
  });

  // 10. Gebied herkennen aan een sterk woord dat in de titel mag blijven ("Felicio nieuwsbrief").
  if (!result.areaId) {
    for (const area of AREAS) {
      if (area.strong.some((kw) => new RegExp(`${START}${esc(kw)}${END}`, "iu").test(s))) {
        result.areaId = area.id;
        break;
      }
    }
  }

  // Titel opschonen
  let title = s
    .replace(/\s*,(\s*,)+/g, ",")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;:\-–\s]+|[,;:\-–\s]+$/g, "")
    .replace(/\s+(?:op|voor|om|en|uiterlijk|deadline)$/i, "")
    .trim();
  if (!title && result.waitingOn) title = `Wachten op ${result.waitingOn}`;
  result.title = title.charAt(0).toUpperCase() + title.slice(1);

  // Chips
  const area = AREAS.find((a) => a.id === result.areaId);
  if (area) result.chips.push({ kind: "gebied", label: result.project ? `${area.short} / ${result.project}` : area.short });
  if (result.deadline)
    result.chips.push({
      kind: "deadline",
      label: `${result.deadlineHard ? "harde " : ""}deadline ${formatRelative(result.deadline, today)}`,
    });
  if (result.planDate) result.chips.push({ kind: "plan", label: `doen ${formatRelative(result.planDate, today)}` });
  if (result.estimate) result.chips.push({ kind: "tijd", label: estimateLabel(result.estimate) });
  if (result.impact) result.chips.push({ kind: "impact", label: `impact ${result.impact}` });
  if (result.status === "wachten")
    result.chips.push({ kind: "status", label: result.waitingOn ? `wachten op ${result.waitingOn}` : "wachten op" });
  if (result.status === "ooit") result.chips.push({ kind: "status", label: "ooit / misschien" });
  if (result.status === "bezig") result.chips.push({ kind: "status", label: "bezig" });

  return result;
}
