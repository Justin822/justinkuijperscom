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
};

export const CATEGORIES: Record<Category, { label: string; emoji: string; color: string }> = {
  kantoor: { label: "Op kantoor", emoji: "💼", color: "#27e1ff" },
  prive: { label: "Thuis & privé", emoji: "🏠", color: "#b98cff" },
  extreem: { label: "Extreem", emoji: "🌶️", color: "#ff2e88" },
};

/** Maximale lengte van een verhaal, zodat het altijd helemaal op het grote scherm past. */
export const STORY_MAX = 280;

/** Iedereen kiest per vraag een top 3. */
export const TOP_N = 3;
/** Punten voor plek 1, 2 en 3. */
export const POINTS = [3, 2, 1];
