import type { Player, Question } from "./types";

// Uitslagberekening voor Ranking the Stars. Puur, zonder opslag,
// zodat dezelfde code ook de generale repetitie (demodata) kan draaien.

export type Ballot = {
  playerId: string;
  rankings: Record<string, string[]>;
  stories: Record<string, string>;
};

export type Placement = {
  id: string;
  rank: number;
  avg: number;
  firstVotes: number;
};

export type Story = { aboutId: string; text: string };

export type QuestionResult = {
  questionId: string;
  voters: number;
  ranking: Placement[];
  stories: Story[];
};

export type ScoreRow = {
  id: string;
  score: number; // mensenkennis in procenten
  exact: number; // aantal keer precies de groepspositie
};

export type Awards = {
  selfAware?: { id: string; avgGap: number };
  denial?: { id: string; questionId: string; selfRank: number; groupRank: number };
  ego?: { id: string; questionId: string; selfRank: number; groupRank: number };
};

export type Results = {
  voters: number;
  questions: QuestionResult[];
  leaderboard: ScoreRow[];
  awards: Awards;
};

export function isFullRanking(order: unknown, ids: string[]): order is string[] {
  if (!Array.isArray(order) || order.length !== ids.length) return false;
  const seen = new Set(order);
  return seen.size === ids.length && ids.every((id) => seen.has(id));
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
  const n = ids.length;
  const maxDeviation = Math.floor((n * n) / 2);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name || id;
  const valid = ballots.filter((b) => ids.includes(b.playerId));

  const questionResults: QuestionResult[] = questions.map((q) => {
    const votes = valid
      .filter((b) => isFullRanking(b.rankings[q.id], ids))
      .map((b) => ({ voter: b.playerId, order: b.rankings[q.id], story: (b.stories[q.id] || "").trim() }));

    const stats = ids.map((id) => {
      const positions = votes.map((v) => v.order.indexOf(id) + 1);
      const avg = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : n;
      return { id, avg, firstVotes: positions.filter((p) => p === 1).length };
    });
    stats.sort(
      (a, b) => a.avg - b.avg || b.firstVotes - a.firstVotes || nameOf(a.id).localeCompare(nameOf(b.id))
    );
    const ranking = stats.map((s, i) => ({ ...s, rank: i + 1 }));

    const winner = ranking[0]?.id;
    const stories = votes
      .filter((v) => v.story)
      .map((v) => ({ aboutId: v.order[0], text: v.story }))
      .sort((a, b) => {
        const aw = a.aboutId === winner ? 0 : 1;
        const bw = b.aboutId === winner ? 0 : 1;
        return aw - bw || hash(a.text) - hash(b.text);
      });

    return { questionId: q.id, voters: votes.length, ranking, stories };
  });

  // Mensenkennis en zelfbeeld per stemmer
  const leaderboard: ScoreRow[] = [];
  const awards: Awards = {};
  let bestSelfGap = Infinity;

  for (const ballot of valid) {
    let accuracySum = 0;
    let answered = 0;
    let exact = 0;
    let selfGapSum = 0;

    questions.forEach((q, qi) => {
      const order = ballot.rankings[q.id];
      if (!isFullRanking(order, ids)) return;
      const groupRank = new Map(questionResults[qi].ranking.map((r) => [r.id, r.rank]));
      let deviation = 0;
      order.forEach((id, i) => {
        const diff = Math.abs(i + 1 - (groupRank.get(id) as number));
        deviation += diff;
        if (diff === 0) exact++;
      });
      accuracySum += 1 - deviation / maxDeviation;
      answered++;

      const selfRank = order.indexOf(ballot.playerId) + 1;
      const groupSelf = groupRank.get(ballot.playerId) as number;
      selfGapSum += Math.abs(selfRank - groupSelf);
      const gap = selfRank - groupSelf;
      if (gap > 0 && (!awards.denial || gap > awards.denial.selfRank - awards.denial.groupRank)) {
        awards.denial = { id: ballot.playerId, questionId: q.id, selfRank, groupRank: groupSelf };
      }
      if (gap < 0 && (!awards.ego || gap < awards.ego.selfRank - awards.ego.groupRank)) {
        awards.ego = { id: ballot.playerId, questionId: q.id, selfRank, groupRank: groupSelf };
      }
    });

    if (!answered) continue;
    leaderboard.push({ id: ballot.playerId, score: Math.round((accuracySum / answered) * 1000) / 10, exact });
    const avgGap = selfGapSum / answered;
    if (avgGap < bestSelfGap) {
      bestSelfGap = avgGap;
      awards.selfAware = { id: ballot.playerId, avgGap: Math.round(avgGap * 10) / 10 };
    }
  }

  leaderboard.sort((a, b) => b.score - a.score || b.exact - a.exact || nameOf(a.id).localeCompare(nameOf(b.id)));

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
        .map((x) => x.id);
      if (rand() < 0.6) stories[q.id] = DEMO_STORIES[Math.floor(rand() * DEMO_STORIES.length)];
    });
    return { playerId: voter, rankings, stories };
  });
}
