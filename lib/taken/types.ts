export type AreaId = "appel" | "felicio" | "cliq" | "side" | "prive";

export type Status = "inbox" | "gepland" | "bezig" | "wachten" | "ooit" | "af";
export type Impact = "laag" | "middel" | "hoog";
export type Source = "handmatig" | "spraak" | "doorgestuurd" | "mail-radar";

export type Task = {
  id: string;
  title: string;
  areaId: AreaId | null;
  project: string | null;
  /** YYYY-MM-DD */
  deadline: string | null;
  deadlineHard: boolean;
  /** Tijdsinschatting in minuten. */
  estimate: number | null;
  impact: Impact | null;
  status: Status;
  source: Source;
  mailLink: string | null;
  /** Hoe vaak de taak bij de dagafsluiting is doorgeschoven. */
  postponed: number;
  /** Dag waarop je de taak wilt doen (YYYY-MM-DD), los van de deadline. */
  planDate: string | null;
  waitingOn: string | null;
  /** Wanneer je nabelt of nastuurt bij "wachten op" (YYYY-MM-DD). */
  followUp: string | null;
  note: string | null;
  createdAt: number;
  updatedAt: number;
  doneAt: number | null;
};

export type Pick = { id: string; reason: string };

export type DayPlan = {
  date: string;
  top3: Pick[];
  /** Taken die je vandaag uit de top 3 hebt gewisseld; die komen er vandaag niet meer in. */
  swapped: string[];
  /** Gebieden van de top 3 op het moment van kiezen, voor de balans over meerdere dagen. */
  areas: (AreaId | null)[];
  closedAt: number | null;
};
