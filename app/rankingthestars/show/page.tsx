import { PLAYERS, QUESTIONS } from "@/lib/rankingthestars/config";
import { GameProvider } from "../_components/GameContext";
import ShowApp from "../_components/ShowApp";

export const metadata = { title: "De show · Ranking the Stars" };

export default function ShowPage() {
  return (
    <GameProvider players={PLAYERS} questions={QUESTIONS}>
      <ShowApp />
    </GameProvider>
  );
}
