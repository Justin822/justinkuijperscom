"use client";

import { useCallback, useEffect, useState } from "react";
import { PLAYERS, QUESTIONS } from "@/lib/rankingthestars/config";
import Avatar from "./Avatar";
import Logo from "./Logo";
import PinGate from "./PinGate";
import { adminCall, getPin, setPin } from "./admin";

type Overview = {
  votingOpen: boolean;
  storage: "redis" | "file";
  persistent: boolean;
  submissions: { playerId: string; updatedAt: number; stories: number }[];
};

const timeFormat = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function HostApp() {
  const [pin, setPinState] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (usePin: string) => {
    try {
      const data = await adminCall<Overview>(usePin, "overview");
      setOverview(data);
      setError(null);
      setPin(usePin);
      setPinState(usePin);
    } catch (e: any) {
      setError(e.message);
      if (e.status === 401 || e.status === 503) {
        setPin("");
        setPinState("");
      }
    }
  }, []);

  useEffect(() => {
    const saved = getPin();
    if (saved) load(saved).finally(() => setReady(true));
    else setReady(true);
  }, [load]);

  useEffect(() => {
    if (!pin) return;
    const timer = window.setInterval(() => load(pin), 10000);
    return () => window.clearInterval(timer);
  }, [pin, load]);

  if (!ready) return null;
  if (!pin || !overview) return <PinGate title="Regiekamer" error={error} onSubmit={load} />;

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      await adminCall(pin, action, extra);
      await load(pin);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitted = new Map(overview.submissions.map((s) => [s.playerId, s]));
  const count = PLAYERS.filter((p) => submitted.has(p.id)).length;
  const playerLink =
    typeof window === "undefined"
      ? ""
      : window.location.origin + (window.location.pathname.startsWith("/rankingthestars") ? "/rankingthestars" : "/");

  return (
    <main className="rts-wrap" style={{ paddingTop: 28 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <Logo size={28} />
        <div>
          <h1 className="rts-display" style={{ fontSize: 28 }}>
            Regiekamer
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            {QUESTIONS.length} vragen · {PLAYERS.length} spelers
          </p>
        </div>
      </header>

      {!overview.persistent && (
        <div className="rts-error" style={{ marginTop: 20 }}>
          <strong>Let op:</strong> er is nog geen database gekoppeld. Stemmen worden nu tijdelijk bewaard en kunnen
          verdwijnen. Voeg in Vercel <em>Upstash Redis</em> toe aan dit project (Storage → Marketplace) en redeploy.
        </div>
      )}
      {error && (
        <div className="rts-error" style={{ marginTop: 20 }}>
          {error}
        </div>
      )}

      <section className="rts-card" style={{ padding: 20, marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="rts-display" style={{ fontSize: 44, lineHeight: 1 }}>
              <span style={{ color: "var(--gold)" }}>{count}</span>
              <span style={{ color: "var(--muted)", fontSize: 24 }}> / {PLAYERS.length}</span>
            </div>
            <div style={{ color: "var(--muted)", marginTop: 4 }}>hebben gestemd</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span
              className="rts-chip"
              style={{ ["--chip" as string]: overview.votingOpen ? "#1ed891" : "#ff2e88", alignSelf: "center" }}
            >
              {overview.votingOpen ? "● Stembus open" : "● Stembus dicht"}
            </span>
            <button
              className="rts-btn rts-btn--ghost rts-btn--small"
              disabled={busy}
              onClick={() => act(overview.votingOpen ? "close" : "open")}
            >
              {overview.votingOpen ? "Stembus sluiten 🔒" : "Stembus openen 🔓"}
            </button>
          </div>
        </div>
        <div
          style={{ marginTop: 16, height: 12, borderRadius: 99, background: "rgba(255,255,255,.1)", overflow: "hidden" }}
        >
          <div
            style={{
              width: `${(count / PLAYERS.length) * 100}%`,
              height: "100%",
              borderRadius: 99,
              background: "linear-gradient(90deg, var(--pink), var(--gold))",
              transition: "width .6s",
            }}
          />
        </div>
      </section>

      <section className="rts-players" style={{ marginTop: 16 }}>
        {PLAYERS.map((p) => {
          const s = submitted.get(p.id);
          return (
            <div
              key={p.id}
              className="rts-player"
              style={{ cursor: "default", opacity: s ? 1 : 0.55, transform: "none" }}
            >
              {s && <span className="rts-player__done">✓</span>}
              <Avatar player={p} size={52} />
              <span>{p.name}</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)", textAlign: "center" }}>
                {s ? (
                  <>
                    {timeFormat.format(new Date(s.updatedAt))} · {s.stories} verhalen
                    <br />
                    <button
                      className="rts-link"
                      style={{ fontSize: 12, marginTop: 4 }}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Stem van ${p.name} verwijderen? Die moet dan opnieuw stemmen.`)) {
                          act("reset", { playerId: p.id });
                        }
                      }}
                    >
                      reset
                    </button>
                  </>
                ) : (
                  "nog niet gestemd"
                )}
              </span>
            </div>
          );
        })}
      </section>

      <section className="rts-card" style={{ padding: 20, marginTop: 16 }}>
        <h2 className="rts-display" style={{ fontSize: 18 }}>
          Link voor collega&apos;s
        </h2>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <input className="rts-input" readOnly value={playerLink} style={{ flex: "1 1 240px" }} />
          <button
            className="rts-btn rts-btn--ghost rts-btn--small"
            onClick={() => {
              navigator.clipboard?.writeText(playerLink).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              });
            }}
          >
            {copied ? "Gekopieerd ✓" : "Kopieer"}
          </button>
        </div>
      </section>

      <section className="rts-card" style={{ padding: 20, marginTop: 16, textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>🎬</div>
        <h2 className="rts-display" style={{ fontSize: 22, marginTop: 4 }}>
          Showtime
        </h2>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6, maxWidth: 520, marginInline: "auto" }}>
          Zet de show op het grote scherm. Bedienen met spatie of → (volgende), ← (terug), F (volledig scherm) en M
          (geluid aan/uit). Tip: sluit eerst de stembus.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
          <a className="rts-btn rts-btn--pink" href="/rankingthestars/show">
            Start de show ⭐
          </a>
          <a className="rts-btn rts-btn--ghost" href="/rankingthestars/show?demo=1">
            Generale repetitie (nepdata)
          </a>
        </div>
      </section>

      <p style={{ textAlign: "center", marginTop: 24 }}>
        <button
          className="rts-link"
          style={{ fontSize: 13 }}
          onClick={() => {
            setPin("");
            setPinState("");
            setOverview(null);
          }}
        >
          Uitloggen
        </button>
      </p>
    </main>
  );
}
