"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PublicSettings } from "@/lib/taken/types";
import { TrashIcon } from "../../_components/icons";
import PageHeader from "../../_components/PageHeader";
import { api, useTaken } from "../../_components/TakenContext";

// Instellingen: Google Agenda koppelen, iCal-links (Outlook) toevoegen en je werkdag.

const FLASH: Record<string, string> = {
  gekoppeld: "Google Agenda is gekoppeld.",
  geannuleerd: "Koppelen geannuleerd.",
  "niet-ingesteld": "Google is nog niet ingesteld. Volg de stappen hieronder.",
};

function Section({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="tk-section" style={{ marginTop: 36 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</h2>
      {intro && <p className="tk-muted mt-1 text-sm">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { settings, setSettings, notify } = useTaken();
  const [flash, setFlash] = useState<{ text: string; error?: boolean } | null>(null);
  const [icsName, setIcsName] = useState("");
  const [icsUrl, setIcsUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [workday, setWorkday] = useState(settings?.workday || { start: "09:00", end: "17:30" });

  // Melding na terugkomst van Google, daarna de adresbalk opschonen.
  useEffect(() => {
    const google = params?.get("google");
    if (!google) return;
    setFlash(
      google === "fout"
        ? { text: `Koppelen mislukt: ${params?.get("reden") || "onbekende fout"}`, error: true }
        : { text: FLASH[google] || "", error: google !== "gekoppeld" }
    );
    router.replace(pathname || "/app/instellingen");
    // Na koppelen meteen je agenda's ophalen en de agenda "Planner" klaarzetten.
    if (google === "gekoppeld") act("googleRefresh", {}, "refresh");
    else api<{ settings: PublicSettings }>("/api/taken/settings").then((d) => setSettings(d.settings)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eén keer vullen; daarna niet meer overschrijven (anders springt een veld terug terwijl je typt).
  const filled = useRef(false);
  useEffect(() => {
    if (settings && !filled.current) {
      filled.current = true;
      setWorkday(settings.workday);
    }
  }, [settings]);

  const act = async (action: string, body: object = {}, label = action) => {
    setBusy(label);
    try {
      const data = await api<{ settings: PublicSettings; found?: number }>("/api/taken/settings", {
        method: "POST",
        body: JSON.stringify({ action, ...body }),
      });
      setSettings(data.settings);
      return data;
    } catch (err: any) {
      notify(err.message);
      return null;
    } finally {
      setBusy(null);
    }
  };

  if (!settings) return <div className="tk-empty">Laden…</div>;
  const g = settings.google;

  const addIcs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!icsUrl.trim()) return;
    const data = await act("addIcs", { name: icsName, url: icsUrl }, "ics");
    if (data) {
      setIcsName("");
      setIcsUrl("");
      notify(`Gekoppeld: ${data.found ?? 0} afspraken in de komende 30 dagen`);
    }
  };

  const toggleCalendar = (id: string) => {
    const selected = g.calendars.filter((c) => (c.id === id ? !c.selected : c.selected)).map((c) => c.id);
    setSettings({ ...settings, google: { ...g, calendars: g.calendars.map((c) => ({ ...c, selected: selected.includes(c.id) })) } });
    act("googleCalendars", { selected }, "calendars");
  };

  const saveWorkday = () => {
    if (workday.start === settings.workday.start && workday.end === settings.workday.end) return;
    if (!workday.start || !workday.end || workday.start >= workday.end) return notify("Kies een begintijd vóór de eindtijd");
    act("workday", workday, "workday").then((d) => d && notify("Werkdag opgeslagen"));
  };

  return (
    <div>
      <PageHeader title="Instellingen" />

      {flash?.text && (
        <div className={`tk-banner ${flash.error ? "is-soft" : ""}`} style={flash.error ? { color: "var(--danger)" } : undefined}>
          <span className="flex-1">{flash.text}</span>
          <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => setFlash(null)}>
            Oké
          </button>
        </div>
      )}

      <Section
        title="Google Agenda"
        intro="Je afspraken uit Google in je Planner, te verslepen en op te rekken. Ingeplande taken komen in een eigen agenda 'Planner' in Google, dus ook op je telefoon; verplaats je ze daar, dan volgt de app."
      >
        {!g.configured ? (
          <div className="tk-card p-4 text-sm leading-6">
            <div className="font-medium">Nog één keer instellen (± 10 minuten)</div>
            <ol className="tk-muted mt-2 list-decimal pl-5">
              <li>
                Ga naar <span className="text-[color:var(--text)]">console.cloud.google.com</span>, ingelogd met je Workspace-account, en maak een project aan.
              </li>
              <li>Zoek &quot;Google Calendar API&quot; en klik Inschakelen.</li>
              <li>OAuth-toestemmingsscherm: kies type <strong>Intern</strong>, vul een naam in (bijv. Planner).</li>
              <li>
                Inloggegevens → Inloggegevens maken → OAuth-client-ID → Webapplicatie. Bij &quot;Geautoriseerde omleidings-URI&apos;s&quot;:{" "}
                <code className="text-[color:var(--text)]">
                  {typeof window !== "undefined" ? window.location.origin : "https://justinkuijpers.com"}/api/taken/google/callback
                </code>
              </li>
              <li>
                Zet de client-ID en het clientgeheim in Vercel als <code>GOOGLE_CLIENT_ID</code> en <code>GOOGLE_CLIENT_SECRET</code> en deploy opnieuw.
              </li>
            </ol>
            <p className="tk-faint mt-2">Daarna staat hier de knop &quot;Koppel Google Agenda&quot;.</p>
          </div>
        ) : !g.connected ? (
          <a href="/api/taken/google/connect" className="tk-btn">
            Koppel Google Agenda
          </a>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="tk-dot" style={{ background: g.needsReconnect ? "var(--danger)" : "var(--ok)" }} />
              <span>
                Gekoppeld{g.email ? ` als ${g.email}` : ""}
                {g.needsReconnect && <span style={{ color: "var(--danger)" }}> · toegang verlopen</span>}
              </span>
              {g.needsReconnect && (
                <a href="/api/taken/google/connect" className="tk-btn tk-btn-sm">
                  Opnieuw koppelen
                </a>
              )}
            </div>
            {!g.needsReconnect && !g.canEdit && (
              <div className="tk-banner is-soft mt-3">
                <span className="min-w-0 flex-1">
                  Koppel opnieuw om afspraken te kunnen bewerken: verslepen, oprekken en nieuwe afspraken maken vanuit de app.
                </span>
                <a href="/api/taken/google/connect" className="tk-btn tk-btn-sm">
                  Opnieuw koppelen
                </a>
              </div>
            )}

            <div className="tk-h2 mt-5">Tonen in de app</div>
            <div className="tk-list mt-1">
              {g.calendars.length === 0 && (
                <div className="tk-empty">
                  {busy === "refresh" ? (
                    "Agenda's ophalen…"
                  ) : (
                    <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" onClick={() => act("googleRefresh", {}, "refresh")}>
                      Agenda&apos;s ophalen
                    </button>
                  )}
                </div>
              )}
              {g.calendars.map((c) => (
                <label key={c.id} className="tk-row cursor-pointer items-center" style={{ padding: "9px 0" }}>
                  <input type="checkbox" checked={c.selected} onChange={() => toggleCalendar(c.id)} />
                  <span className="tk-dot" style={{ background: c.color || "var(--faint)" }} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                </label>
              ))}
            </div>
            {g.canEdit && g.calendars.some((c) => c.writable !== false) && (
              <label className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="tk-muted">Nieuwe afspraken in</span>
                <select
                  className="tk-select"
                  style={{ width: "auto", padding: "6px 10px" }}
                  value={g.defaultCalendarId || ""}
                  onChange={(e) => {
                    setSettings({ ...settings, google: { ...g, defaultCalendarId: e.target.value } });
                    act("googleDefault", { calendarId: e.target.value }, "default");
                  }}
                >
                  {!g.defaultCalendarId && <option value="">Kies een agenda</option>}
                  {g.calendars
                    .filter((c) => c.writable !== false)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <p className="tk-faint mt-2 text-xs">
              {g.planner
                ? "Ingeplande taken komen in de agenda 'Planner'. Die staat hier niet, want die zie je al als timeblocks."
                : "De agenda 'Planner' kon niet worden aangemaakt; koppel opnieuw om timeblocks in Google te zetten."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="tk-btn tk-btn-ghost tk-btn-sm" disabled={!!busy} onClick={() => act("googleRefresh", {}, "refresh")}>
                {busy === "refresh" ? "Bezig…" : "Agenda's vernieuwen"}
              </button>
              <button
                type="button"
                className="tk-btn tk-btn-danger tk-btn-sm"
                disabled={!!busy}
                onClick={() => {
                  if (window.confirm("Google Agenda ontkoppelen? De agenda 'Planner' blijft in Google staan.")) {
                    act("googleDisconnect", {}, "disconnect").then((d) => d && notify("Google Agenda ontkoppeld"));
                  }
                }}
              >
                Ontkoppelen
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Outlook en andere agenda's"
        intro="Plak de iCal-link (ICS) van je agenda. De app leest hem alleen en haalt hem hooguit elke 5 minuten op."
      >
        {settings.icsSources.length > 0 && (
          <div className="tk-list mb-4">
            {settings.icsSources.map((s) => (
              <div key={s.id} className="tk-row items-center" style={{ padding: "9px 0" }}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="tk-faint truncate text-xs">{s.preview}</div>
                </div>
                <button
                  type="button"
                  className="tk-icon-btn"
                  aria-label={`${s.name} verwijderen`}
                  onClick={() => act("removeIcs", { id: s.id }, "remove").then((d) => d && notify(`${s.name} verwijderd`))}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={addIcs} className="flex flex-col gap-2">
          <input
            className="tk-input"
            value={icsName}
            onChange={(e) => setIcsName(e.target.value)}
            placeholder="Naam, bijv. Outlook Appèl"
            aria-label="Naam van de agenda"
          />
          <input
            className="tk-input"
            value={icsUrl}
            onChange={(e) => setIcsUrl(e.target.value)}
            placeholder="https://outlook.office365.com/owa/calendar/…/calendar.ics"
            aria-label="iCal-link"
            inputMode="url"
            autoComplete="off"
          />
          <div>
            <button type="submit" className="tk-btn" disabled={!icsUrl.trim() || !!busy}>
              {busy === "ics" ? "Link testen…" : "Agenda toevoegen"}
            </button>
          </div>
        </form>
        <details className="tk-muted mt-4 text-sm">
          <summary className="cursor-pointer">Waar vind ik de link?</summary>
          <div className="mt-2 leading-6">
            <strong className="text-[color:var(--text)]">Outlook (web):</strong> Instellingen (tandwiel) → Agenda → Gedeelde agenda&apos;s → &quot;Een agenda publiceren&quot; → kies je agenda en &quot;Kan alle details bekijken&quot; → Publiceren → kopieer de <strong>ICS</strong>-link.
            <br />
            Zie je die optie niet bij Appèl, dan heeft IT publiceren uitgezet.
            <br />
            <strong className="text-[color:var(--text)]">Apple iCloud:</strong> Agenda-app → deel de agenda als openbare agenda en kopieer de link.
            <br />
            Deel zo&apos;n link met niemand: wie hem heeft, kan je agenda lezen.
          </div>
        </details>
      </Section>

      <Section title="Werkdag" intro="Gebruikt voor je vrije tijd per dag en de keuze van je top 3.">
        <div className="flex items-center gap-2">
          <input
            className="tk-input"
            type="time"
            step={900}
            value={workday.start}
            onChange={(e) => setWorkday((w) => ({ ...w, start: e.target.value }))}
            onBlur={saveWorkday}
            style={{ maxWidth: 130 }}
            aria-label="Begin werkdag"
          />
          <span className="tk-muted">tot</span>
          <input
            className="tk-input"
            type="time"
            step={900}
            value={workday.end}
            onChange={(e) => setWorkday((w) => ({ ...w, end: e.target.value }))}
            onBlur={saveWorkday}
            style={{ maxWidth: 130 }}
            aria-label="Einde werkdag"
          />
        </div>
      </Section>
    </div>
  );
}
