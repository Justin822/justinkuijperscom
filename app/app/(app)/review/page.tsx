"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addDays, formatRelative, MONTHS, weekday, WEEKDAYS_SHORT } from "@/lib/taken/dates";
import { computeReview } from "@/lib/taken/review";
import type { DayPlan } from "@/lib/taken/types";
import { ChevronLeftIcon, ChevronRightIcon } from "../../_components/icons";
import PageHeader from "../../_components/PageHeader";
import { focusLabel } from "../../_components/TaskRow";
import { api, useTaken } from "../../_components/TakenContext";

// Weekreview: de succescriteria uit je plan, per gebied wat er gebeurd is, en je focus voor volgende week.

/** ISO-weeknummer. */
function weekNumber(monday: string) {
  const thursday = addDays(monday, 3);
  const jan4 = `${thursday.slice(0, 4)}-01-04`;
  const firstMonday = addDays(jan4, -((weekday(jan4) + 6) % 7));
  return Math.floor((Date.parse(thursday) - Date.parse(firstMonday)) / (7 * 86400000)) + 1;
}

function Stat({ value, total, label }: { value: React.ReactNode; total?: number; label: string }) {
  return (
    <div className="tk-stat">
      <div className="tk-stat-value">
        {value}
        {total !== undefined && <small> / {total}</small>}
      </div>
      <div className="tk-stat-label">{label}</div>
    </div>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const { tasks, today, createNote, notify, openTask } = useTaken();
  const thisMonday = addDays(today, -((weekday(today) + 6) % 7));
  const [monday, setMonday] = useState(thisMonday);
  const [data, setData] = useState<{ dates: string[]; plans: (DayPlan | null)[] } | null>(null);
  const [focusText, setFocusText] = useState("");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    api<{ dates: string[]; plans: (DayPlan | null)[] }>(`/api/taken/review?from=${monday}`)
      .then((d) => !cancelled && setData(d))
      .catch((err) => notify(err.message));
    return () => {
      cancelled = true;
    };
  }, [monday, notify]);

  const review = useMemo(() => (data ? computeReview(data.dates, data.plans, tasks) : null), [data, tasks]);
  const week = weekNumber(monday);
  const sunday = addDays(monday, 6);
  const range = `${Number(monday.slice(8))} ${MONTHS[Number(monday.slice(5, 7)) - 1].slice(0, 3)} – ${Number(sunday.slice(8))} ${MONTHS[Number(sunday.slice(5, 7)) - 1].slice(0, 3)}`;
  const workdaysSoFar = Array.from({ length: 5 }, (_, i) => addDays(monday, i)).filter((d) => d <= today).length;

  const saveFocus = async () => {
    if (!focusText.trim() || !review) return;
    const lines = [
      `Weekreview week ${week}`,
      "",
      `Top 3 gehaald: ${review.top3Days} van ${workdaysSoFar} werkdagen`,
      `Dag afgesloten: ${review.closedDays} · inbox leeg: ${review.inboxZeroDays}`,
      `Taken af: ${review.doneCount} · focus: ${focusLabel(review.focusTotal)}`,
      "",
      "Focus volgende week",
      focusText.trim(),
    ];
    const note = await createNote({ body: lines.join("\n") });
    setFocusText("");
    notify("Opgeslagen als notitie");
    router.push(`/app/notities/${note.id}`);
  };

  return (
    <div>
      <PageHeader eyebrow={range} title={`Week ${week}`}>
        {monday !== thisMonday && (
          <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => setMonday(thisMonday)}>
            Deze week
          </button>
        )}
        <button type="button" className="tk-icon-btn" onClick={() => setMonday(addDays(monday, -7))} aria-label="Vorige week">
          <ChevronLeftIcon />
        </button>
        <button
          type="button"
          className="tk-icon-btn"
          onClick={() => setMonday(addDays(monday, 7))}
          disabled={monday >= thisMonday}
          aria-label="Volgende week"
        >
          <ChevronRightIcon />
        </button>
      </PageHeader>

      {!review ? (
        <div className="tk-empty">Laden…</div>
      ) : (
        <>
          <div className="tk-stats">
            <Stat value={review.top3Days} total={Math.max(workdaysSoFar, 1)} label="dagen top 3 gehaald (doel 4)" />
            <Stat value={review.closedDays} total={Math.max(workdaysSoFar, 1)} label="dagen afgesloten" />
            <Stat value={review.doneCount} label="taken af" />
            <Stat value={review.focusTotal ? focusLabel(review.focusTotal) : "0"} label="gefocust" />
          </div>

          <section className="tk-section">
            <div className="tk-daystrip">
              {review.days.map((d) => (
                <div key={d.date} className="tk-daycell" style={{ opacity: d.date > today ? 0.4 : 1 }}>
                  <span>{WEEKDAYS_SHORT[weekday(d.date)]}</span>
                  <div className="tk-bar" title={`${d.top3Done} van ${d.top3Total}`}>
                    <span style={{ width: d.top3Total ? `${(d.top3Done / d.top3Total) * 100}%` : 0 }} />
                  </div>
                  <span className="tk-num" style={{ color: "var(--text)", fontWeight: 550 }}>
                    {d.top3Total ? `${d.top3Done}/${d.top3Total}` : "–"}
                  </span>
                  <span style={{ fontSize: 11 }}>{d.closed ? (d.inboxZero ? "✓ leeg" : "✓") : ""}</span>
                </div>
              ))}
            </div>
            <p className="tk-faint mt-2 text-xs">Balkje = top 3 afgerond. ✓ = dag afgesloten, &quot;leeg&quot; = inbox op nul.</p>
          </section>

          <section className="tk-section">
            <h2 className="tk-h2 mb-1">Per gebied</h2>
            {review.areas.length === 0 ? (
              <div className="tk-empty">Nog niets te laten zien.</div>
            ) : (
              <table className="tk-table">
                <thead>
                  <tr>
                    <th>Gebied</th>
                    <th>Af</th>
                    <th>Open</th>
                    <th>Focus</th>
                  </tr>
                </thead>
                <tbody>
                  {review.areas.map((a) => (
                    <tr key={a.name}>
                      <td>
                        <span className="tk-dot mr-2" style={{ background: a.color }} />
                        {a.name}
                        {a.postponed > 0 && <span className="tk-faint"> · {a.postponed} doorgeschoven</span>}
                      </td>
                      <td>{a.done}</td>
                      <td>{a.open}</td>
                      <td>{a.focusMinutes ? focusLabel(a.focusMinutes) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {review.mostPostponed.length > 0 && (
            <section className="tk-section">
              <h2 className="tk-h2 mb-1">Blijft liggen</h2>
              <div className="tk-list">
                {review.mostPostponed.map((t) => (
                  <button key={t.id} type="button" className="tk-row w-full text-left" onClick={() => openTask(t.id)}>
                    <span className="tk-row-title flex-1">{t.title}</span>
                    <span className="tk-muted text-sm">
                      {t.postponed}× · {t.deadline ? formatRelative(t.deadline, today) : "geen deadline"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="tk-faint mt-2 text-xs">Doen, inplannen of schrappen? Beslis het bij de dagafsluiting.</p>
            </section>
          )}

          <section className="tk-section">
            <h2 className="tk-h2 mb-2">Focus voor volgende week</h2>
            <textarea
              className="tk-textarea"
              rows={4}
              value={focusText}
              onChange={(e) => setFocusText(e.target.value)}
              placeholder="Wat moet volgende week echt gebeuren? Wat laat je bewust liggen?"
            />
            <button type="button" className="tk-btn mt-2" disabled={!focusText.trim()} onClick={saveFocus}>
              Opslaan als notitie
            </button>
          </section>
        </>
      )}
    </div>
  );
}
