"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AREAS, OPEN_STATUSES } from "@/lib/taken/config";
import { addDays, formatRelative, MONTHS, weekday } from "@/lib/taken/dates";
import { rankTasks } from "@/lib/taken/score";
import type { AreaId, Task } from "@/lib/taken/types";
import CalendarGrid from "../../_components/calendar/CalendarGrid";
import { useDragSource } from "../../_components/calendar/DragLayer";
import { durationLabel } from "../../_components/calendar/time";
import { ChevronLeftIcon, ChevronRightIcon, GearIcon } from "../../_components/icons";
import { useAgenda, useTaken } from "../../_components/TakenContext";

// Week: je afspraken en timeblocks over meerdere dagen. Sleep taken uit de lade de week in.

type Span = 1 | 3 | 5 | 7;
const SPAN_KEY = "tk-week-span";
const RECONNECT_KEY = "tk-hide-reconnect";

/** ISO-weeknummer. */
function weekNumber(date: string) {
  const monday = addDays(date, -((weekday(date) + 6) % 7));
  const thursday = addDays(monday, 3);
  const jan4 = `${thursday.slice(0, 4)}-01-04`;
  const firstMonday = addDays(jan4, -((weekday(jan4) + 6) % 7));
  return Math.floor((Date.parse(thursday) - Date.parse(firstMonday)) / (7 * 86400000)) + 1;
}

export default function WeekPage() {
  const router = useRouter();
  const { tasks, today, openTask, settings } = useTaken();
  const [anchor, setAnchor] = useState(today);
  const [span, setSpan] = useState<Span>(7);
  const [tray, setTray] = useState(true);
  const [area, setArea] = useState<AreaId | null>(null);
  const [hideReconnect, setHideReconnect] = useState(true);
  useEffect(() => {
    try {
      setHideReconnect(localStorage.getItem(RECONNECT_KEY) === "1");
    } catch {
      setHideReconnect(false);
    }
  }, []);
  const askReconnect = Boolean(settings?.google.connected && !settings.google.needsReconnect && !settings.google.canEdit && !hideReconnect);
  const dragSource = useDragSource();
  const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches;

  useEffect(() => {
    let saved: Span | null = null;
    try {
      saved = Number(localStorage.getItem(SPAN_KEY)) as Span;
    } catch {
      // geen opslag beschikbaar
    }
    if (phone) setSpan(saved === 1 ? 1 : 3);
    else setSpan(saved === 5 ? 5 : 7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const chooseSpan = (s: Span) => {
    setSpan(s);
    try {
      localStorage.setItem(SPAN_KEY, String(s));
    } catch {
      // geen opslag beschikbaar
    }
  };

  // Week (5/7) begint op maandag; 1 en 3 dagen beginnen bij het gekozen anker.
  const first = span >= 5 ? addDays(anchor, -((weekday(anchor) + 6) % 7)) : anchor;
  const days = Array.from({ length: span }, (_, i) => addDays(first, i));
  const step = span >= 5 ? 7 : span;
  const { data } = useAgenda(days[0], days[days.length - 1]);

  const toPlan = useMemo(
    () =>
      rankTasks(tasks, today, [])
        .map((s) => s.task)
        .filter((t) => !t.blockStart && (!area || t.areaId === area)),
    [tasks, today, area]
  );

  // Vegen op de kop: vorige/volgende.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [y, m] = days[0].split("-").map(Number);
  const lastMonth = Number(days[days.length - 1].slice(5, 7));
  const monthLabel = lastMonth !== m ? `${MONTHS[m - 1].slice(0, 3)} – ${MONTHS[lastMonth - 1].slice(0, 3)} ${y}` : `${MONTHS[m - 1]} ${y}`;

  return (
    <div>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="tk-eyebrow first-letter:uppercase">{monthLabel}</div>
          <h1 className="tk-h1">Week {weekNumber(days[0])}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <div className="tk-seg tk-desktop-only">
            <button type="button" aria-pressed={span === 5} onClick={() => chooseSpan(5)}>
              Werkweek
            </button>
            <button type="button" aria-pressed={span === 7} onClick={() => chooseSpan(7)}>
              Week
            </button>
          </div>
          <div className="tk-seg tk-mobile-only">
            <button type="button" aria-pressed={span === 1} onClick={() => chooseSpan(1)}>
              Dag
            </button>
            <button type="button" aria-pressed={span === 3} onClick={() => chooseSpan(3)}>
              3 dagen
            </button>
          </div>
          <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm ml-1" onClick={() => setAnchor(today)}>
            Vandaag
          </button>
          <button type="button" className="tk-icon-btn" onClick={() => setAnchor(addDays(anchor, -step))} aria-label="Vorige">
            <ChevronLeftIcon />
          </button>
          <button type="button" className="tk-icon-btn" onClick={() => setAnchor(addDays(anchor, step))} aria-label="Volgende">
            <ChevronRightIcon />
          </button>
          <button type="button" className="tk-icon-btn" onClick={() => router.push("/app/instellingen")} aria-label="Agenda's koppelen">
            <GearIcon />
          </button>
        </div>
      </header>

      {data && !data.configured && (
        <div className="tk-banner is-soft mb-3">
          <span className="min-w-0 flex-1">Koppel je Google Agenda of Outlook om je afspraken hier te zien.</span>
          <button type="button" className="tk-btn tk-btn-sm" onClick={() => router.push("/app/instellingen")}>
            Agenda koppelen
          </button>
        </div>
      )}
      {askReconnect && (
        <div className="tk-banner is-soft mb-3">
          <span className="min-w-0 flex-1">Ook je Google-afspraken verslepen en oprekken? Koppel Google één keer opnieuw.</span>
          <a href="/api/taken/google/connect" className="tk-btn tk-btn-sm">
            Opnieuw koppelen
          </a>
          <button
            type="button"
            className="tk-btn tk-btn-quiet tk-btn-sm"
            onClick={() => {
              setHideReconnect(true);
              try {
                localStorage.setItem(RECONNECT_KEY, "1");
              } catch {
                // geen opslag beschikbaar
              }
            }}
          >
            Later
          </button>
        </div>
      )}
      {data?.errors?.length ? (
        <p className="mb-2 text-sm" style={{ color: "var(--warn)" }}>
          Niet bereikbaar: {data.errors.join(", ")}
        </p>
      ) : null}

      <div className="tk-week-layout" data-tray={tray ? "open" : "closed"}>
        <aside className="tk-week-tray tk-desktop-only">
          <div className="flex items-center justify-between">
            <h2 className="tk-h2">Te plannen</h2>
            <button type="button" className="tk-btn tk-btn-quiet tk-btn-sm" onClick={() => setTray((v) => !v)}>
              {tray ? "Verbergen" : "Toon"}
            </button>
          </div>
          {tray && (
            <>
              <div className="tk-pills mt-2" style={{ gap: 4 }}>
                <button type="button" className="tk-pill" style={{ height: 24, fontSize: 12 }} aria-pressed={!area} onClick={() => setArea(null)}>
                  Alles
                </button>
                {AREAS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="tk-pill"
                    style={{ height: 24, fontSize: 12 }}
                    aria-pressed={area === a.id}
                    onClick={() => setArea(area === a.id ? null : a.id)}
                  >
                    <span className="tk-dot" style={{ background: a.color }} />
                    {a.short}
                  </button>
                ))}
              </div>
              <p className="tk-faint mt-2 text-xs">Sleep een taak naar een dag en tijd.</p>
              <div className="mt-1">
                {toPlan.length === 0 && <div className="tk-empty">Alles staat ingepland.</div>}
                {toPlan.slice(0, 40).map((t: Task) => (
                  <div
                    key={t.id}
                    className="tk-plan-row is-draggable"
                    onPointerDown={(e) => e.pointerType === "mouse" && dragSource(t)(e)}
                    onClick={() => openTask(t.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="tk-row-title" style={{ fontSize: 14 }}>
                        {t.title}
                      </div>
                      <div className="tk-meta">
                        <span>{durationLabel(t.estimate || 30)}</span>
                        {t.areaId && <span>{AREAS.find((a) => a.id === t.areaId)?.short}</span>}
                        {OPEN_STATUSES.includes(t.status) && t.planDate && <span>{formatRelative(t.planDate, today)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        <div
          className="min-w-0"
          onTouchStart={(e) => {
            const target = e.target as HTMLElement;
            touch.current = target.closest(".cal-head") ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
          }}
          onTouchEnd={(e) => {
            if (!touch.current) return;
            const dx = e.changedTouches[0].clientX - touch.current.x;
            const dy = e.changedTouches[0].clientY - touch.current.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) setAnchor(addDays(anchor, dx < 0 ? step : -step));
            touch.current = null;
          }}
        >
          <CalendarGrid
            days={days}
            events={data?.events || []}
            showHeader
            hourHeight={phone ? 44 : 48}
            onDayClick={(day) => router.push(`/app?datum=${day}`)}
            layoutKey={`${Boolean(data && !data.configured)}-${data?.errors?.length || 0}-${askReconnect}`}
          />
        </div>
      </div>
    </div>
  );
}
