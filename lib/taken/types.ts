export type AreaId = "appel" | "felicio" | "cliq" | "side" | "prive";

export type Status = "inbox" | "gepland" | "bezig" | "wachten" | "ooit" | "af";
export type Impact = "laag" | "middel" | "hoog";
export type Source = "handmatig" | "spraak" | "doorgestuurd" | "mail-radar" | "notitie" | "snelknop" | "gedeeld";

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
  /** Bij een herhaling: de afgevinkte taak waaruit deze volgende keer is ontstaan. */
  spawnedFrom: string | null;
  /** Timeblock in de agenda: "YYYY-MM-DDTHH:mm" (lokale tijd); duur = estimate. */
  blockStart: string | null;
  /** Minuten die je met de focus-timer aan deze taak hebt gewerkt. */
  focusMinutes: number;
  /** Afspraak in de Google-agenda "Planner" voor het timeblock. */
  googleEventId: string | null;
  /** Wanneer de app het timeblock voor het laatst naar Google schreef; latere wijzigingen komen uit Google. */
  googleSyncedAt: number | null;
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
  /** Taken die bij het afsluiten van deze dag al zijn doorgeschoven (nogmaals afsluiten telt ze niet dubbel). */
  postponed?: string[];
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
  /** Kleur van de agenda (Google), anders null. */
  color: string | null;
  /** Openen in Google Agenda. */
  link: string | null;
  /** Videogesprek: Meet, Teams of Zoom. */
  meetUrl: string | null;
  /** Waar de afspraak vandaan komt. */
  source: "google" | "ics";
  /** Google: de agenda en het event (bij een herhaling het id van deze ene keer). */
  calendarId: string | null;
  eventId: string | null;
  /** Tijd, titel en duur zijn in de app aan te passen (Google, schrijfrechten, jij organiseert). */
  editable: boolean;
  /** Aantal andere gasten: bij wijzigen kies je of zij een mail krijgen. */
  guests: number;
  /** Deel van een herhalende reeks: een wijziging geldt alleen voor deze keer. */
  recurring: boolean;
  /** Wie je heeft uitgenodigd, als je zelf niet de organisator bent. */
  organizer: string | null;
};

export type IcsSource = { id: string; name: string; url: string };

export type GoogleCalendar = {
  id: string;
  name: string;
  color: string | null;
  selected: boolean;
  /** Je mag er afspraken in zetten (eigenaar of schrijfrechten). */
  writable?: boolean;
  primary?: boolean;
};

export type GoogleLink = {
  refreshToken: string;
  email: string | null;
  calendars: GoogleCalendar[];
  /** De eigen agenda "Planner" waar timeblocks in komen. */
  plannerCalendarId: string | null;
  /** Google weigert de koppeling (ingetrokken): opnieuw koppelen nodig. */
  needsReconnect: boolean;
  /** Rechten die Google heeft gegeven (oudere koppelingen: onbekend). */
  scopes?: string[];
  /** Agenda voor nieuwe afspraken uit de app. */
  defaultCalendarId?: string | null;
};

/** Sleutel waarmee een snelknop of ander apparaat taken in je Inbox mag zetten (alleen de hash wordt bewaard). */
export type CaptureToken = { id: string; name: string; hash: string; createdAt: number; lastUsedAt: number | null };

/** Mail-radar: gelabelde mails in Gmail worden taken. */
export type MailSettings = {
  enabled: boolean;
  /** Gmail-label-id's (worden aangemaakt als ze er nog niet zijn). */
  labels: { taak: string; wachten: string; verwerkt: string } | null;
  lastRunAt: number | null;
  lastError: string | null;
  lastCount: number;
};

/** Welke pushmeldingen je wilt (voor alle apparaten). */
export type PushPrefs = {
  /** 's Ochtends je top 3, plus deadlines en nabellen van vandaag. */
  ochtend: boolean;
  /** Herinnering om je dag af te sluiten, op `afsluitTijd`. */
  afsluiten: boolean;
  afsluitTijd: string;
  /** Melding als je focus-timer klaar is, ook als de app dicht is. */
  focus: boolean;
};

export type Settings = {
  icsSources: IcsSource[];
  workday: { start: string; end: string };
  google: GoogleLink | null;
  captureTokens?: CaptureToken[];
  mail?: MailSettings;
  push?: PushPrefs;
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
    /** Afspraken bewerken mag (recht calendar.events); anders eerst opnieuw koppelen. */
    canEdit: boolean;
    defaultCalendarId: string | null;
  };
  captureTokens: { id: string; name: string; createdAt: number; lastUsedAt: number | null }[];
  mail: { available: boolean; enabled: boolean; lastRunAt: number | null; lastError: string | null; lastCount: number };
  push: PushPrefs & { configured: boolean; publicKey: string | null; scheduled: boolean; devices: number };
};
