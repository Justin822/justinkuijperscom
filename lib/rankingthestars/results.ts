import { POINTS, TOP_N, type Player, type Question } from "./types";

// Uitslagberekening voor Ranking the Stars. Puur, zonder opslag,
// zodat dezelfde code ook de generale repetitie (demodata) kan draaien.
//
// Iedereen kiest per vraag een top 3: #1 = 3 punten, #2 = 2, #3 = 1.

export type Ballot = {
  playerId: string;
  rankings: Record<string, string[]>;
  stories: Record<string, string>;
};

export type Placement = {
  id: string;
  rank: number;
  points: number;
  firstVotes: number;
  secondVotes: number;
};

export type Story = { aboutId: string; text: string };

export type QuestionResult = {
  questionId: string;
  voters: number;
  ranking: Placement[]; // alleen collega's met punten
  stories: Story[];
};

export type ScoreRow = {
  id: string;
  score: number; // mensenkennis-punten
  exact: number; // aantal keer precies de juiste plek
};

export type Awards = {
  star?: { id: string; points: number };
  denial?: { id: string; questionId: string; points: number };
  ego?: { id: string; count: number };
};

export type Results = {
  voters: number;
  questions: QuestionResult[];
  leaderboard: ScoreRow[];
  awards: Awards;
};

/** Precies TOP_N verschillende, bekende spelers. */
export function isValidTop(order: unknown, ids: string[]): order is string[] {
  if (!Array.isArray(order) || order.length !== TOP_N) return false;
  return new Set(order).size === TOP_N && order.every((id) => ids.includes(id));
}

// Inzendingen van vóór de top 3 bevatten alle 12 namen: pak dan de eerste 3.
function topOf(order: unknown, ids: string[]): string[] | null {
  if (!Array.isArray(order)) return null;
  const top = order.slice(0, TOP_N);
  return isValidTop(top, ids) ? top : null;
}

// Simpele deterministische hash zodat de volgorde van verhalen niet
// verraadt wie wat schreef (niet de volgorde van inzenden).
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function computeResults(players: Player[], questions: Question[], ballots: Ballot[]): Results {
  const ids = players.map((p) => p.id);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name || id;
  const valid = ballots.filter((b) => ids.includes(b.playerId));

  const questionResults: QuestionResult[] = questions.map((q) => {
    const votes = valid
      .map((b) => ({ voter: b.playerId, top: topOf(b.rankings[q.id], ids), story: (b.stories[q.id] || "").trim() }))
      .filter((v): v is { voter: string; top: string[]; story: string } => v.top !== null);

    const stats = ids.map((id) => {
      let points = 0;
      let firstVotes = 0;
      let secondVotes = 0;
      for (const v of votes) {
        const pos = v.top.indexOf(id);
        if (pos < 0) continue;
        points += POINTS[pos];
        if (pos === 0) firstVotes++;
        if (pos === 1) secondVotes++;
      }
      return { id, points, firstVotes, secondVotes };
    });
    const ranking = stats
      .filter((s) => s.points > 0)
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.firstVotes - a.firstVotes ||
          b.secondVotes - a.secondVotes ||
          nameOf(a.id).localeCompare(nameOf(b.id))
      )
      .map((s, i) => ({ ...s, rank: i + 1 }));

    const winner = ranking[0]?.id;
    const stories = votes
      .filter((v) => v.story)
      .map((v) => ({ aboutId: v.top[0], text: v.story }))
      .sort((a, b) => {
        const aw = a.aboutId === winner ? 0 : 1;
        const bw = b.aboutId === winner ? 0 : 1;
        return aw - bw || hash(a.text) - hash(b.text);
      });

    return { questionId: q.id, voters: votes.length, ranking, stories };
  });

  // Mensenkennis: 3 punten voor precies de juiste plek in de groeps-top 3,
  // 1 punt als die collega wel in de groeps-top 3 staat maar op een andere plek.
  const leaderboard: ScoreRow[] = [];
  const selfVotes = new Map<string, number>();

  for (const ballot of valid) {
    let score = 0;
    let exact = 0;
    let answered = 0;
    questions.forEach((q, qi) => {
      const top = topOf(ballot.rankings[q.id], ids);
      if (!top) return;
      answered++;
      const groupTop = questionResults[qi].ranking.slice(0, TOP_N).map((r) => r.id);
      top.forEach((id, i) => {
        if (groupTop[i] === id) {
          score += 3;
          exact++;
        } else if (groupTop.includes(id)) {
          score += 1;
        }
      });
      if (top.includes(ballot.playerId)) selfVotes.set(ballot.playerId, (selfVotes.get(ballot.playerId) || 0) + 1);
    });
    if (answered) leaderboard.push({ id: ballot.playerId, score, exact });
  }
  leaderboard.sort((a, b) => b.score - a.score || b.exact - a.exact || nameOf(a.id).localeCompare(nameOf(b.id)));

  const awards: Awards = {};

  // Ster van de avond: meeste punten over alle vragen samen
  const totals = new Map<string, number>();
  questionResults.forEach((qr) => qr.ranking.forEach((r) => totals.set(r.id, (totals.get(r.id) || 0) + r.points)));
  ids.forEach((id) => {
    const points = totals.get(id) || 0;
    if (points > 0 && (!awards.star || points > awards.star.points)) awards.star = { id, points };
  });

  // Ontkenning: won een vraag, maar zette zichzelf niet in de eigen top 3
  questionResults.forEach((qr, qi) => {
    const winner = qr.ranking[0];
    if (!winner) return;
    const own = valid.find((b) => b.playerId === winner.id);
    const ownTop = own ? topOf(own.rankings[questions[qi].id], ids) : null;
    if (!ownTop || ownTop.includes(winner.id)) return;
    if (!awards.denial || winner.points > awards.denial.points) {
      awards.denial = { id: winner.id, questionId: qr.questionId, points: winner.points };
    }
  });

  // Ster in eigen ogen: zette zichzelf het vaakst in de eigen top 3
  ids.forEach((id) => {
    const count = selfVotes.get(id) || 0;
    if (count > 0 && (!awards.ego || count > awards.ego.count)) awards.ego = { id, count };
  });

  return { voters: valid.length, questions: questionResults, leaderboard, awards };
}

const DEMO_STORIES = [
  "Ik zeg alleen: kerstborrel 2023. Meer hoef ik niet te zeggen.",
  "Ik heb het met eigen ogen gezien en ik ben er nog steeds niet overheen.",
  "Begon heel onschuldig met 'ik pak even een koekje'. Drie uur later...",
  "Deed het met zo'n overtuiging dat niemand durfde te zeggen dat het niet klopte.",
  "Stond er met een kop koffie naast en zei: 'Dit komt helemaal goed.' Het kwam niet goed.",
  "De zwaan had nog medelijden ook.",
  "Heeft er een Excel-sheet voor gemaakt. Met kleurcodes.",
  "Iedereen weet het, niemand zegt het. Tot vandaag.",
  "Het was dinsdag, het regende, en er was geen weg meer terug.",
  "Zei 'even kort' en toen was het ineens vrijdag.",
];

// Nepstemmen voor een generale repetitie. Met een lichte voorkeur per vraag,
// zodat de uitslag er realistisch uitziet.
export function makeDemoBallots(players: Player[], questions: Question[], seed = 42): Ballot[] {
  let s = seed;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const ids = players.map((p) => p.id);

  const favourites: Record<string, Record<string, number>> = {};
  questions.forEach((q) => {
    favourites[q.id] = {};
    ids.forEach((id) => (favourites[q.id][id] = rand() * 3));
  });

  return ids.map((voter) => {
    const rankings: Record<string, string[]> = {};
    const stories: Record<string, string> = {};
    questions.forEach((q) => {
      rankings[q.id] = [...ids]
        .map((id) => ({ id, w: favourites[q.id][id] + rand() * 2.5 }))
        .sort((a, b) => b.w - a.w)
        .slice(0, TOP_N)
        .map((x) => x.id);
      if (rand() < 0.6) stories[q.id] = DEMO_STORIES[Math.floor(rand() * DEMO_STORIES.length)];
    });
    return { playerId: voter, rankings, stories };
  });
}
