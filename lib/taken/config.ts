import type { AreaId, Impact, Status } from "./types";

export type Area = {
  id: AreaId;
  name: string;
  short: string;
  color: string;
  /** Woorden die als los stukje ("…, Appèl, …") of #tag het gebied kiezen. */
  keywords: string[];
  /** Woorden die ook midden in een zin het gebied kiezen (en in de titel blijven staan). */
  strong: string[];
  /** Niet meer te kiezen; taken en notities houden het gebied wel. */
  archived?: boolean;
};

/** De gebieden waarmee de app begint; je eigen lijst staat in de instellingen. */
export const DEFAULT_AREAS: Area[] = [
  {
    id: "appel",
    name: "Appèl",
    short: "Appèl",
    color: "#e4572e",
    keywords: ["appèl", "appel", "werk"],
    strong: ["appèl"],
  },
  {
    id: "felicio",
    name: "Felicio",
    short: "Felicio",
    color: "#d64f9a",
    keywords: ["felicio"],
    strong: ["felicio"],
  },
  {
    id: "cliq",
    name: "cliq.photo",
    short: "cliq",
    color: "#2e86de",
    keywords: ["cliq.photo", "cliq"],
    strong: ["cliq.photo", "cliq"],
  },
  {
    id: "side",
    name: "Overige side projects",
    short: "Side",
    color: "#8e44ad",
    keywords: ["side", "sideproject", "side project", "side projects", "seocrawlerlite", "seocrawler", "idee", "ideeën"],
    strong: ["seocrawlerlite", "seocrawler"],
  },
  {
    id: "prive",
    name: "Privé en huishouden",
    short: "Privé",
    color: "#27ae60",
    keywords: ["privé", "prive", "thuis", "huis", "huishouden", "persoonlijk"],
    strong: [],
  },
];

/** Je gebieden: uit de instellingen, anders de standaard. */
export const areasOf = (settings: { areas?: Area[] | null } | null | undefined): Area[] =>
  settings?.areas && settings.areas.length ? settings.areas : DEFAULT_AREAS;

/** Gebieden die je nog kunt kiezen (niet gearchiveerd). */
export const activeAreas = (areas: Area[]) => areas.filter((a) => !a.archived);

export const areaMap = (areas: Area[]): Record<AreaId, Area> => Object.fromEntries(areas.map((a) => [a.id, a]));

export const STATUS_LABEL: Record<Status, string> = {
  inbox: "Inbox",
  gepland: "Gepland",
  bezig: "Bezig",
  wachten: "Wachten op",
  ooit: "Ooit / misschien",
  af: "Af",
};

export const IMPACT_LABEL: Record<Impact, string> = { laag: "Laag", middel: "Middel", hoog: "Hoog" };

export const ESTIMATES = [5, 15, 30, 60, 120, 240, 480];

export function estimateLabel(minutes: number | null | undefined) {
  if (!minutes) return "";
  if (minutes === 240) return "halve dag";
  if (minutes >= 480) return "hele dag";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1).replace(".", ",")} uur`;
}

/** Statussen die nog werk zijn (komen in aanmerking voor de top 3). */
export const OPEN_STATUSES: Status[] = ["inbox", "gepland", "bezig"];

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "gebied";

const words = (value: unknown) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [])
        .filter((w): w is string => typeof w === "string")
        .map((w) => w.trim().toLowerCase().slice(0, 30))
        .filter(Boolean)
    )
  ).slice(0, 20);

/**
 * Je gebieden uit Instellingen nakijken: geldige namen, kleuren en trefwoorden, unieke id's.
 * Bestaande id's blijven staan (taken verwijzen ernaar); een nieuw gebied krijgt een id uit zijn naam.
 * Geeft een foutmelding (string) als het niet klopt.
 */
export function cleanAreas(input: unknown): Area[] | string {
  if (!Array.isArray(input) || !input.length) return "Je hebt minstens één gebied nodig.";
  if (input.length > 20) return "Maximaal 20 gebieden.";
  const out: Area[] = [];
  const used = new Set<string>();
  for (const raw of input) {
    const name = typeof raw?.name === "string" ? raw.name.trim().slice(0, 40) : "";
    if (!name) return "Geef elk gebied een naam.";
    let id = typeof raw?.id === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(raw.id) ? raw.id : slug(name);
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    used.add(id);
    const short = (typeof raw?.short === "string" && raw.short.trim().slice(0, 16)) || name.slice(0, 16);
    const color = typeof raw?.color === "string" && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color.toLowerCase() : "#737373";
    out.push({ id, name, short, color, keywords: words(raw?.keywords), strong: words(raw?.strong), archived: Boolean(raw?.archived) || undefined });
  }
  if (!out.some((a) => !a.archived)) return "Laat minstens één gebied actief.";
  return out;
}
