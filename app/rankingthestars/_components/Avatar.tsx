"use client";

import type { Player } from "@/lib/rankingthestars/types";
import { useGame } from "./GameContext";

const COLORS = [
  "linear-gradient(135deg, #ff2e88, #b3006b)",
  "linear-gradient(135deg, #27e1ff, #0077c2)",
  "linear-gradient(135deg, #ffb13d, #e0560b)",
  "linear-gradient(135deg, #9b6bff, #5a1fd1)",
  "linear-gradient(135deg, #1ed891, #008a5e)",
  "linear-gradient(135deg, #ff5f5f, #b8132d)",
  "linear-gradient(135deg, #ffd93d, #d18b00)",
  "linear-gradient(135deg, #5f8bff, #2839c7)",
  "linear-gradient(135deg, #ff7ae0, #a51fa0)",
  "linear-gradient(135deg, #2ee6c5, #0b8f8f)",
  "linear-gradient(135deg, #ff9a6b, #c4400c)",
  "linear-gradient(135deg, #b5f23d, #4f9a00)",
];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  player,
  size = 44,
  className = "",
  style,
}: {
  player: Player;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { PLAYERS } = useGame();
  const index = Math.max(0, PLAYERS.findIndex((p) => p.id === player.id));
  return (
    <span
      className={`rts-avatar ${className}`}
      style={{
        fontSize: size,
        width: "1em",
        height: "1em",
        ["--av" as string]: COLORS[index % COLORS.length],
        ...style,
      }}
      aria-hidden
    >
      {player.photo ? <img src={player.photo} alt="" /> : <span style={{ fontSize: "0.38em" }}>{initials(player.name)}</span>}
    </span>
  );
}
