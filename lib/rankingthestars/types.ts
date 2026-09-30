// Types en weergave-instellingen voor Ranking the Stars.
// Deze mogen in de browser terechtkomen; namen en vragen staan in config.ts
// en gaan alleen naar spelers die de teamcode hebben ingevuld.

export type Player = {
  id: string;
  name: string;
  photo?: string;
};

export type Category = "kantoor" | "prive" | "extreem";

export type Question = {
  id: string;
  category: Category;
  question: string;
  storyPrompt: string;
};

export const CATEGORIES: Record<Category, { label: string; emoji: string; color: string }> = {
  kantoor: { label: "Op kantoor", emoji: "💼", color: "#27e1ff" },
  prive: { label: "Thuis & privé", emoji: "🏠", color: "#b98cff" },
  extreem: { label: "Extreem", emoji: "🌶️", color: "#ff2e88" },
};

export const STORY_MAX = 600;
