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
};

export const AREAS: Area[] = [
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

export const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a])) as Record<AreaId, Area>;

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
