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
    id: "bruiloft",
    category: "kantoor",
    question: "Wie beantwoordt tijdens zijn/haar eigen bruiloft nog even een mailtje?",
    storyPrompt: "Aan wie, en wat stond er in die mail?",
  },
  {
    id: "sparren",
    category: "kantoor",
    question: "Wie zegt “even kort sparren” en houdt je een uur aan de praat?",
    storyPrompt: "Waar ging dat ‘korte’ gesprek over?",
  },
  {
    id: "druk",
    category: "kantoor",
    question: "Wie lijkt het drukst terwijl hij/zij helemaal niks doet?",
    storyPrompt: "Hoe flikt hij/zij dat?",
  },
  {
    id: "chocola",
    category: "kantoor",
    question: "Wie laat je nooit alleen met de kantoorchocola?",
    storyPrompt: "Wat gebeurde er de vorige keer?",
  },
  {
    id: "auto",
    category: "prive",
    question: "Wie zingt het hardst mee in de auto?",
    storyPrompt: "Welk nummer, en hoe klinkt het?",
  },
  {
    id: "ikea",
    category: "prive",
    question: "Wie leest nooit de handleiding en houdt bij de IKEA-kast drie schroeven over?",
    storyPrompt: "Hoe ziet die kast er nu uit?",
  },
  {
    id: "spotify",
    category: "prive",
    question: "Wie heeft het meest gênante nummer in zijn/haar Spotify Wrapped?",
    storyPrompt: "Welk nummer is het, en wanneer draait hij/zij het?",
  },
  {
    id: "geheim",
    category: "prive",
    question: "Wie heeft een geheim leven?",
    storyPrompt: "Wat is het? Verzin gerust iets.",
  },
  {
    id: "zombie",
    category: "extreem",
    question: "Wie gaat er als eerste dood in een zombie-apocalyps?",
    storyPrompt: "Hoe gaat het precies mis?",
  },
  {
    id: "zwaan",
    category: "extreem",
    question: "Wie verliest een gevecht met een zwaan?",
    storyPrompt: "Hoe begon de ruzie?",
  },
  {
    id: "lijk",
    category: "extreem",
    question: "Wie bel je om 3 uur ’s nachts als je een lijk moet verstoppen?",
    storyPrompt: "Waarom juist die, en wat zegt hij/zij als eerste?",
  },
  {
    id: "gearresteerd",
    category: "extreem",
    question: "Wie wordt op vakantie gearresteerd?",
    storyPrompt: "Voor welk vergrijp?",
  },
];

export function playerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}
