import { PLAYERS, QUESTIONS } from "@/lib/rankingthestars/config";
import { GameProvider } from "./_components/GameContext";
import VoteApp from "./_components/VoteApp";

export default function RankingTheStarsPage() {
  return (
    <GameProvider players={PLAYERS} questions={QUESTIONS}>
      <VoteApp />
    </GameProvider>
  );
}
