import { addDays, diffDays, makeDate, weekday, WEEKDAYS } from "./dates";
import type { Repeat, Task } from "./types";
import { newId } from "./validate";

// Terugkerende taken: als je er één afvinkt, staat de volgende keer meteen klaar.

const WORKDAYS = [1, 2, 3, 4, 5];

export function repeatLabel(repeat: Repeat | null | undefined): string {
  if (!repeat) return "";
  const { every, unit, weekdays } = repeat;
  if (weekdays && weekdays.join() === WORKDAYS.join()) return "elke werkdag";
  if (weekdays?.length) {
    const days = weekdays.map((d) => WEEKDAYS[d]).join(" en ");
    return every > 1 ? `om de ${every} weken op ${days}` : `elke ${days}`;
  }
  if (every === 1) return unit === "dag" ? "elke dag" : unit === "week" ? "elke week" : "elke maand";
  return `elke ${every} ${unit === "dag" ? "dagen" : unit === "week" ? "weken" : "maanden"}`;
}

function addMonths(iso: string, months: number, day: number) {
  const [y, m] = iso.split("-").map(Number);
  const index = m - 1 + months;
  const year = y + Math.floor(index / 12);
  const month = (index % 12) + 1;
  // Bestaat de dag niet (31 februari), dan de laatste dag van de maand.
  for (let d = day; d >= 28; d--) {
    const date = makeDate(year, month, d);
    if (date) return date;
  }
  return makeDate(year, month, day) as string;
}

/** Eerste dag ná `after` waarop de herhaling valt. */
export function nextDate(repeat: Repeat, base: string, after: string): string {
  const { every, unit, weekdays } = repeat;
  if (weekdays?.length) {
    // Bij "om de 2 weken op maandag" eerst de tussenliggende weken overslaan.
    const start = unit === "week" && every > 1 ? addDays(after, 7 * (every - 1)) : after;
    for (let i = 1; i <= 7; i++) {
      const date = addDays(start, i);
      if (weekdays.includes(weekday(date))) return date;
    }
  }
  if (unit === "maand") {
    const day = Number(base.slice(8, 10));
    let date = addMonths(base, every, day);
    while (date <= after) date = addMonths(date, every, day);
    return date;
  }
  const step = unit === "week" ? 7 * every : every;
  let date = addDays(base, step);
  // Lang blijven liggen: niet alle gemiste keren inhalen, gewoon de eerstvolgende.
  if (date <= after) date = addDays(base, step * (Math.floor(diffDays(base, after) / step) + 1));
  return date;
}

/** De eerste keer: vandaag als dat past, anders de eerstvolgende passende dag. */
export function firstDate(repeat: Repeat, today: string): string {
  if (repeat.weekdays?.length && !repeat.weekdays.includes(weekday(today))) {
    return nextDate({ ...repeat, every: 1 }, today, today);
  }
  return today;
}

/** De volgende taak in de reeks, of null als de taak niet herhaalt. */
export function spawnNext(task: Task, today: string, now = Date.now()): Task | null {
  if (!task.repeat) return null;
  const base = task.planDate || task.deadline || today;
  const after = base > today ? base : today;
  const next = nextDate(task.repeat, base, after);
  const shift = diffDays(base, next);
  return {
    ...task,
    id: newId(now),
    status: "gepland",
    planDate: next,
    deadline: task.deadline ? addDays(task.deadline, shift) : null,
    blockStart: null,
    postponed: 0,
    focusMinutes: 0,
    createdAt: now,
    updatedAt: now,
    doneAt: null,
  };
}
