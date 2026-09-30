"use client";

import { createContext, useContext, useMemo } from "react";
import type { Player, Question } from "@/lib/rankingthestars/types";

// Namen en vragen komen via de (achter de teamcode afgeschermde) pagina binnen,
// zodat ze niet in de publieke JavaScript-bundels van de site staan.

type Game = {
  PLAYERS: Player[];
  QUESTIONS: Question[];
  playerById: (id: string) => Player | undefined;
  questionById: (id: string) => Question | undefined;
};

const GameContext = createContext<Game | null>(null);

export function GameProvider({
  players,
  questions,
  children,
}: {
  players: Player[];
  questions: Question[];
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      PLAYERS: players,
      QUESTIONS: questions,
      playerById: (id: string) => players.find((p) => p.id === id),
      questionById: (id: string) => questions.find((q) => q.id === id),
    }),
    [players, questions]
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): Game {
  const game = useContext(GameContext);
  if (!game) throw new Error("useGame moet binnen een GameProvider gebruikt worden");
  return game;
}
