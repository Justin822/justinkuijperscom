import { AREAS, OPEN_STATUSES } from "./config";
import { localToday, weekday } from "./dates";
import type { AreaId, DayPlan, Task } from "./types";

// Weekreview zonder AI: gewoon tellen wat er gebeurd is.

export type DayReview = {
  date: string;
  workday: boolean;
  hasPlan: boolean;
  top3Done: number;
  top3Total: number;
  closed: boolean;
  inboxZero: boolean;
};

export type AreaReview = {
  areaId: AreaId | null;
  name: string;
  color: string;
  done: number;
  focusMinutes: number;
  open: number;
  postponed: number;
};

export function computeReview(dates: string[], plans: (DayPlan | null)[], tasks: Task[], dayOf = localToday) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const inWeek = (ms: number | null) => Boolean(ms && dates.includes(dayOf(ms)));

  const days: DayReview[] = dates.map((date, i) => {
    const plan = plans[i];
    const picks = plan?.top3 || [];
    const top3Done = picks.filter((p) => {
      const t = byId.get(p.id);
      return t?.status === "af" && t.doneAt && dayOf(t.doneAt) <= date;
    }).length;
    return {
      date,
      workday: weekday(date) >= 1 && weekday(date) <= 5,
      hasPlan: Boolean(plan && picks.length),
      top3Done,
      top3Total: picks.length,
      closed: Boolean(plan?.closedAt),
      inboxZero: Boolean(plan?.closedAt && plan.inboxAtClose === 0),
    };
  });

  const done = tasks.filter((t) => t.status === "af" && inWeek(t.doneAt));
  const open = tasks.filter((t) => OPEN_STATUSES.includes(t.status) || t.status === "wachten");

  const areaRow = (areaId: AreaId | null, name: string, color: string): AreaReview => ({
    areaId,
    name,
    color,
    done: done.filter((t) => t.areaId === areaId).length,
    // Focusminuten van taken die deze week af zijn of nog open staan.
    focusMinutes: [...done, ...open].filter((t) => t.areaId === areaId).reduce((sum, t) => sum + (t.focusMinutes || 0), 0),
    open: open.filter((t) => t.areaId === areaId).length,
    postponed: open.filter((t) => t.areaId === areaId && t.postponed > 0).length,
  });

  const areas = [
    ...AREAS.map((a) => areaRow(a.id, a.name, a.color)),
    areaRow(null, "Zonder gebied", "var(--faint)"),
  ].filter((a) => a.done || a.open || a.focusMinutes);

  const workdays = days.filter((d) => d.workday);
  return {
    days,
    top3Days: workdays.filter((d) => d.top3Total > 0 && d.top3Done === d.top3Total).length,
    workdaysWithPlan: workdays.filter((d) => d.hasPlan).length,
    closedDays: workdays.filter((d) => d.closed).length,
    inboxZeroDays: workdays.filter((d) => d.inboxZero).length,
    doneCount: done.length,
    focusTotal: areas.reduce((sum, a) => sum + a.focusMinutes, 0),
    areas,
    mostPostponed: open
      .filter((t) => t.postponed > 0)
      .sort((a, b) => b.postponed - a.postponed)
      .slice(0, 5),
  };
}
