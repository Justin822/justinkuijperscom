// Ranking the Stars: spelers en vragen.
// Alleen server-side gebruiken: de pagina's geven deze gegevens pas door na de teamcode.
// Namen aanpassen? Verander alleen `name` (en eventueel `photo`), laat de `id` staan.
// Een foto zet je in /public/rts-photos/ en verwijs je als "/rts-photos/naam.jpg".

import type { Player, Question } from "./types";

export { CATEGORIES, STORY_MAX } from "./types";
export type { Category, Player, Question } from "./types";

export const PLAYERS: Player[] = [
  { id: "p1", name: "Michelle" },
  { id: "p2", name: "Jade" },
  { id: "p3", name: "Sabine" },
  { id: "p4", name: "Mieke" },
  { id: "p5", name: "Lisa" },
  { id: "p6", name: "Justin" },
  { id: "p7", name: "Carlijne" },
  { id: "p8", name: "Vanessa" },
  { id: "p9", name: "Esmee" },
  { id: "p10", name: "Joyce" },
  { id: "p11", name: "Lola" },
  { id: "p12", name: "Hidde" },
];

export const QUESTIONS: Question[] = [
  {
    id: "chocola",
    category: "kantoor",
    question: "Wie is de grootste chocoladeliefhebber?",
  },
  {
    id: "ict",
    category: "kantoor",
    question: "Wie stuurt de meeste tickets in bij ICT?",
  },
  {
    id: "taart",
    category: "kantoor",
    question: "Wie staat er als eerste beneden als de taart klaarligt tijdens verjaardag van de maand?",
  },
  {
    id: "boetes",
    category: "extreem",
    question: "Wie pakt de meeste boetes?",
  },
  {
    id: "grappen",
    category: "extreem",
    question: "Wie lacht het hardst om de eigen grappen?",
  },
  {
    id: "aankomen",
    category: "kantoor",
    question: "Wie hoor je aankomen voordat je hem/haar op kantoor ziet?",
  },
  {
    id: "schoonkind",
    category: "prive",
    question: "Wie is de ideale schoondochter/schoonzoon?",
  },
  {
    id: "maps",
    category: "prive",
    question: "Wie zou er verdwalen met Google Maps bij de hand?",
  },
  {
    id: "geheim",
    category: "extreem",
    question: "Bij wie is een geheim het minst lang veilig?",
  },
  {
    id: "meezingers",
    category: "prive",
    question: "Wie kent alle meezingers uit het hoofd?",
  },
  {
    id: "etentje",
    category: "prive",
    question: "Wie kun je beter geen etentje laten verzorgen?",
  },
  {
    id: "linkerhanden",
    category: "prive",
    question: "Wie heeft er 2 linkerhanden?",
  },
  {
    id: "stappen",
    category: "prive",
    question: "Wie zet de meeste stappen op een dag?",
  },
  {
    id: "terras",
    category: "prive",
    question: "Wie kan geen terras voorbij lopen zonder te willen gaan zitten?",
  },
  {
    id: "alibi",
    category: "extreem",
    question: "Welke collega zou je vragen als je een alibi nodig hebt?",
  },
];

export function playerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}
