// Licht, donker of het systeem volgen; per apparaat bewaard. Het script in app/app/layout.tsx
// zet de keuze al vóór de eerste weergave, zodat het scherm niet even de verkeerde kleur toont.

import { readLocal, writeLocal } from "./device";

export type Theme = "systeem" | "licht" | "donker";
export const THEME_KEY = "tk-theme";
const COLORS = { licht: "#ffffff", donker: "#0a0a0a" };

/** Inline-script voor de layout (geen imports beschikbaar): zelfde logica als applyTheme. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="licht"||t==="donker")document.documentElement.dataset.theme=t==="licht"?"light":"dark"}catch(e){}`;

export function readTheme(): Theme {
  const t = readLocal(THEME_KEY);
  return t === "licht" || t === "donker" ? t : "systeem";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "systeem") delete root.dataset.theme;
  else root.dataset.theme = theme === "licht" ? "light" : "dark";
  // De kleur van de statusbalk (Android) meeveranderen.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const dark = (meta.media || "").includes("dark");
    meta.content = theme === "systeem" ? (dark ? COLORS.donker : COLORS.licht) : COLORS[theme];
  });
}

export function setTheme(theme: Theme) {
  writeLocal(THEME_KEY, theme === "systeem" ? null : theme);
  applyTheme(theme);
}
