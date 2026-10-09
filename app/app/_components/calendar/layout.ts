// Overlappende blokken naast elkaar, zoals in Google Agenda:
// eerst kolommen toewijzen per groep overlappers, daarna mag een blok rechts uitbreiden
// over kolommen waar niets overlapt.

export type Span = { id: string; start: number; end: number };
export type Placed = { id: string; left: number; width: number };

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

export function layoutDay(items: Span[]): Map<string, Placed> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const result = new Map<string, Placed>();
  let cluster: { item: Span; col: number }[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const { item, col } of cluster) {
      let span = 1;
      for (let k = col + 1; k < cols; k++) {
        const blocked = cluster.some((o) => o.col === k && overlaps(o.item, item));
        if (blocked) break;
        span++;
      }
      result.set(item.id, { id: item.id, left: col / cols, width: span / cols });
    }
    cluster = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    // Eerste kolom waarvan het laatste blok al is afgelopen.
    let col = 0;
    while (cluster.some((c) => c.col === col && overlaps(c.item, item))) col++;
    cluster.push({ item, col });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return result;
}
