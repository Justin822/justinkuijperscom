import { CalendarIcon, ChartIcon, ListIcon, MoonIcon, NoteIcon, SunIcon } from "./icons";

export const NAV = [
  { href: "/app", label: "Vandaag", Icon: SunIcon },
  { href: "/app/taken", label: "Taken", Icon: ListIcon },
  { href: "/app/agenda", label: "Agenda", Icon: CalendarIcon },
  { href: "/app/notities", label: "Notities", Icon: NoteIcon },
];

export const EXTRA = [
  { href: "/app/review", label: "Weekreview", Icon: ChartIcon },
  { href: "/app/afsluiten", label: "Dag afsluiten", Icon: MoonIcon },
];
