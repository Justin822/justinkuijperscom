// Gedeelde browserhulpjes: schermbreedte, lokale voorkeuren en de service worker.

/** De service worker van deze build (zie next.config.js). */
export const SW_URL = `/taken-sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID || "dev"}`;

/** Telefoon-indeling (onderbalk, Lijst/Dag-wissel); gelijk aan het 900px-breekpunt in taken.css. */
export const PHONE_QUERY = "(max-width: 899px)";
/** Smal scherm: popovers worden een paneel onderin; gelijk aan het 640px-breekpunt in taken.css. */
export const NARROW_QUERY = "(max-width: 639px)";

const matches = (query: string) => typeof window !== "undefined" && window.matchMedia(query).matches;
export const isPhone = () => matches(PHONE_QUERY);
export const isNarrow = () => matches(NARROW_QUERY);

/** localStorage lezen; kan ontbreken (privévenster, geblokkeerd) en dan is het gewoon null. */
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** localStorage schrijven (null = weghalen); fouten negeren, het is alleen een voorkeur. */
export function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // geen opslag beschikbaar
  }
}
