import { PLAYERS, QUESTIONS } from "@/lib/rankingthestars/config";
import { GameProvider } from "../_components/GameContext";
import HostApp from "../_components/HostApp";

export const metadata = { title: "Regiekamer · Ranking the Stars" };

export default function HostPage() {
  return (
    <GameProvider players={PLAYERS} questions={QUESTIONS}>
      <HostApp />
    </GameProvider>
  );
}
