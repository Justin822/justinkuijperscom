import { canEdit, googleConfigured } from "./google";
import type { PublicSettings, Settings } from "./types";

// Wat de browser van de instellingen mag zien: geen tokens en geen volledige agenda-links.

function maskUrl(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() || "";
    return `${u.host}/…/${last.length > 24 ? `${last.slice(0, 6)}…${last.slice(-10)}` : last}`;
  } catch {
    return "link";
  }
}

export function publicSettings(s: Settings): PublicSettings {
  return {
    icsSources: s.icsSources.map(({ id, name, url }) => ({ id, name, preview: maskUrl(url) })),
    workday: s.workday,
    google: {
      configured: googleConfigured(),
      connected: Boolean(s.google),
      email: s.google?.email || null,
      calendars: s.google?.calendars || [],
      needsReconnect: Boolean(s.google?.needsReconnect),
      planner: Boolean(s.google?.plannerCalendarId),
      canEdit: canEdit(s.google),
      defaultCalendarId: s.google?.defaultCalendarId || null,
    },
  };
}
