import type { Task } from "@/lib/taken/types";

/** Dinsdag 13 oktober 2026. */
export const TODAY = "2026-10-13";

let seq = 0;
export function task(fields: Partial<Task> = {}): Task {
  seq++;
  return {
    id: `t${seq}`,
    title: `Taak ${seq}`,
    areaId: null,
    project: null,
    deadline: null,
    deadlineHard: false,
    estimate: null,
    impact: null,
    status: "gepland",
    source: "handmatig",
    mailLink: null,
    postponed: 0,
    planDate: null,
    waitingOn: null,
    followUp: null,
    note: null,
    repeat: null,
    spawnedFrom: null,
    blockStart: null,
    focusMinutes: 0,
    googleEventId: null,
    googleSyncedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    doneAt: null,
    ...fields,
  };
}
