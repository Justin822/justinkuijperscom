"use client";

import { useCallback } from "react";
import type { CalendarEvent } from "@/lib/taken/types";
import { api, editAgenda, useTaken } from "../TakenContext";
import { localParts } from "./time";

// Google-afspraken bewerken vanuit de agenda: direct zichtbaar, daarna naar Google.
// Lukt het niet, dan springt de afspraak terug met een melding. Alles is ongedaan te maken.

export type EventChange = { title?: string; start?: number; end?: number };

const dayOf = (e: CalendarEvent) => (e.allDay ? (e.startDate as string) : localParts(e.start).date);
const same = (a: CalendarEvent, b: CalendarEvent) =>
  a.eventId !== null && a.calendarId === b.calendarId && a.eventId === b.eventId;

/** Zet een afspraak in alle weergaven op een nieuwe stand (null = weg). */
function put(target: CalendarEvent, next: CalendarEvent | null) {
  editAgenda((events, range) => {
    const rest = events.filter((e) => !same(e, target) && e.id !== target.id);
    if (!next) return rest;
    const day = dayOf(next);
    return day >= range.from && day <= range.to ? [...rest, next].sort((a, b) => a.start - b.start) : rest;
  });
}

const path = (e: CalendarEvent) => `/api/taken/events/${encodeURIComponent(e.eventId as string)}`;

export function useEvents() {
  const { notify } = useTaken();

  /** Tijd of titel aanpassen. `guests`: gasten krijgen een mail over de wijziging. */
  const update = useCallback(
    async (event: CalendarEvent, change: EventChange, message: string | null, guests = false) => {
      const next = { ...event, ...change };
      put(event, next);
      if (message) {
        const back: EventChange = { title: event.title, start: event.start, end: event.end };
        notify(message, () => update(next, back, null, guests));
      }
      try {
        const data = await api<{ event: CalendarEvent | null }>(path(event), {
          method: "PATCH",
          body: JSON.stringify({ calendarId: event.calendarId, ...change, notify: guests }),
        });
        if (data.event) put(next, data.event);
      } catch (err: any) {
        put(next, event);
        notify(err.message);
      }
    },
    [notify]
  );

  /** Nieuwe afspraak in Google (standaard in je hoofdagenda). */
  const create = useCallback(
    async (input: { title: string; start: number; end: number; calendarId?: string | null; calendar?: string; color?: string | null }) => {
      const temp: CalendarEvent = {
        id: `tmp:${Date.now()}`,
        calendar: input.calendar || "Google Agenda",
        title: input.title,
        location: null,
        allDay: false,
        start: input.start,
        end: input.end,
        startDate: null,
        endDate: null,
        busy: true,
        color: input.color ?? null,
        link: null,
        meetUrl: null,
        source: "google",
        calendarId: input.calendarId || null,
        eventId: null,
        editable: false,
        guests: 0,
        recurring: false,
        organizer: null,
      };
      put(temp, temp);
      try {
        const data = await api<{ event: CalendarEvent | null }>("/api/taken/events", {
          method: "POST",
          body: JSON.stringify({ title: input.title, start: input.start, end: input.end, calendarId: input.calendarId || null }),
        });
        put(temp, data.event);
        const created = data.event;
        if (created) notify(`Afspraak ${created.title} in ${created.calendar}`, () => remove(created, false, false));
        return created;
      } catch (err: any) {
        put(temp, null);
        notify(err.message);
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify]
  );

  /** Afspraak verwijderen. `guests`: gasten krijgen een afmelding. Ongedaan maken zet hem terug in Google. */
  const remove = useCallback(
    async (event: CalendarEvent, guests = false, undoable = true) => {
      put(event, null);
      if (undoable) {
        notify("Afspraak verwijderd", async () => {
          put(event, event);
          try {
            const data = await api<{ event: CalendarEvent | null }>(path(event), {
              method: "PATCH",
              body: JSON.stringify({ calendarId: event.calendarId, restore: true, notify: guests }),
            });
            if (data.event) put(event, data.event);
          } catch (err: any) {
            put(event, null);
            notify(`Terugzetten lukte niet: ${err.message}`);
          }
        });
      }
      try {
        await api(`${path(event)}?calendarId=${encodeURIComponent(event.calendarId as string)}${guests ? "&notify=1" : ""}`, {
          method: "DELETE",
        });
      } catch (err: any) {
        put(event, event);
        notify(err.message);
      }
    },
    [notify]
  );

  return { update, create, remove };
}

/** Kan deze afspraak in het rooster versleept en opgerekt worden? (Google, bewerkbaar, binnen één dag.) */
export const movable = (e: CalendarEvent | undefined) =>
  Boolean(e && e.editable && e.eventId && !e.allDay && localParts(e.start).date === localParts(e.end - 1).date);
