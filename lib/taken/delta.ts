// Alleen wat er veranderd is: bij terugkeren in de app hoeft niet alles opnieuw over de lijn.
// De server stuurt de gewijzigde records plus de id's van alles wat er nog is (voor verwijderingen).

export type Delta<T> = { items: T[]; ids?: string[]; now: number };

/** `?since=` uit de URL; null = alles sturen. */
export function sinceParam(request: Request): number | null {
  const raw = new URL(request.url).searchParams.get("since");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Wat de server terugstuurt: alles, of (met since) alleen wat daarna is gewijzigd plus alle id's. */
export function makeDelta<T extends { id: string; updatedAt: number }>(all: T[], since: number | null, now = Date.now()): Delta<T> {
  if (since === null) return { items: all, now };
  return { items: all.filter((x) => x.updatedAt > since), ids: all.map((x) => x.id), now };
}

/** De lijst in de browser bijwerken met een delta (zonder `ids`: de hele lijst vervangen). */
export function applyDelta<T extends { id: string }>(list: T[], delta: Delta<T>): T[] {
  if (!delta.ids) return delta.items;
  const keep = new Set(delta.ids);
  const changed = new Map(delta.items.map((x) => [x.id, x]));
  const next = list.filter((x) => keep.has(x.id)).map((x) => changed.get(x.id) || x);
  for (const x of delta.items) if (!list.some((y) => y.id === x.id)) next.push(x);
  return next;
}
