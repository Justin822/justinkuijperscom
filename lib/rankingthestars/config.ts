// Ranking the Stars: spelers en vragen.
// Namen aanpassen? Verander alleen `name` (en eventueel `photo`), laat de `id` staan.
// Een foto zet je in /public/rts-photos/ en verwijs je als "/rts-photos/naam.jpg".

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

export const PLAYERS: Player[] = [
  { id: "p1", name: "Collega 1" },
  { id: "p2", name: "Collega 2" },
  { id: "p3", name: "Collega 3" },
  { id: "p4", name: "Collega 4" },
  { id: "p5", name: "Collega 5" },
  { id: "p6", name: "Collega 6" },
  { id: "p7", name: "Collega 7" },
  { id: "p8", name: "Collega 8" },
  { id: "p9", name: "Collega 9" },
  { id: "p10", name: "Collega 10" },
  { id: "p11", name: "Collega 11" },
  { id: "p12", name: "Collega 12" },
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

export const CATEGORIES: Record<Category, { label: string; emoji: string; color: string }> = {
  kantoor: { label: "Op kantoor", emoji: "💼", color: "#27e1ff" },
  prive: { label: "Thuis & privé", emoji: "🏠", color: "#b98cff" },
  extreem: { label: "Extreem", emoji: "🌶️", color: "#ff2e88" },
};

export const STORY_MAX = 600;

export function playerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}
