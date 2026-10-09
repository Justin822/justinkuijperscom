export type AreaId = "appel" | "felicio" | "cliq" | "side" | "prive";

export type Status = "inbox" | "gepland" | "bezig" | "wachten" | "ooit" | "af";
export type Impact = "laag" | "middel" | "hoog";
export type Source = "handmatig" | "spraak" | "doorgestuurd" | "mail-radar" | "notitie";

/** Herhaling: elke `every` dagen/weken/maanden, eventueel alleen op bepaalde weekdagen (0 = zondag). */
export type Repeat = { every: number; unit: "dag" | "week" | "maand"; weekdays: number[] | null };

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
  repeat: Repeat | null;
  /** Timeblock in de agenda: "YYYY-MM-DDTHH:mm" (lokale tijd); duur = estimate. */
  blockStart: string | null;
  /** Minuten die je met de focus-timer aan deze taak hebt gewerkt. */
  focusMinutes: number;
  /** Afspraak in de Google-agenda "Planner" voor het timeblock. */
  googleEventId: string | null;
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
  /** Aantal taken in de Inbox op het moment van afsluiten (voor de weekreview). */
  inboxAtClose?: number | null;
};

export type Note = {
  id: string;
  /** Platte tekst; de eerste regel is de titel. */
  body: string;
  areaId: AreaId | null;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export type CalendarEvent = {
  id: string;
  calendar: string;
  title: string;
  location: string | null;
  allDay: boolean;
  /** Begin en eind als tijdstip (ms). Bij hele dagen: middernacht UTC van de datums. */
  start: number;
  end: number;
  /** Alleen bij hele dagen: eerste dag en de dag ná de laatste (YYYY-MM-DD). */
  startDate: string | null;
  endDate: string | null;
  /** Telt mee als bezet (TRANSP:TRANSPARENT telt niet). */
  busy: boolean;
};

export type IcsSource = { id: string; name: string; url: string };

export type GoogleCalendar = { id: string; name: string; color: string | null; selected: boolean };

export type GoogleLink = {
  refreshToken: string;
  email: string | null;
  calendars: GoogleCalendar[];
  /** De eigen agenda "Planner" waar timeblocks in komen. */
  plannerCalendarId: string | null;
  /** Google weigert de koppeling (ingetrokken): opnieuw koppelen nodig. */
  needsReconnect: boolean;
};

export type Settings = {
  icsSources: IcsSource[];
  workday: { start: string; end: string };
  google: GoogleLink | null;
};

/** Wat de browser van de instellingen te zien krijgt: geen tokens, geen volledige links. */
export type PublicSettings = {
  icsSources: { id: string; name: string; preview: string }[];
  workday: { start: string; end: string };
  google: {
    configured: boolean;
    connected: boolean;
    email: string | null;
    calendars: GoogleCalendar[];
    needsReconnect: boolean;
    planner: boolean;
  };
};
