"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORIES, POINTS, STORY_MAX, STORY_MIN, TOP_N } from "@/lib/rankingthestars/types";
import { useGame } from "./GameContext";
import Avatar from "./Avatar";
import Confetti from "./Confetti";
import Logo from "./Logo";

type Draft = {
  rankings: Record<string, string[]>;
  stories: Record<string, string>;
};

type Status = { votingOpen: boolean; submitted: string[] };

type Phase = "loading" | "intro" | "who" | "question" | "review" | "done";

const EMPTY_DRAFT: Draft = { rankings: {}, stories: {} };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function deviceToken(): string {
  const store = storage();
  let token = store?.getItem("rts:token") || "";
  if (token.length < 16) {
    token =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    store?.setItem("rts:token", token);
  }
  return token;
}

function loadDraft(playerId: string): Draft {
  try {
    const raw = storage()?.getItem(`rts:draft:${playerId}`);
    if (raw) {
      const draft: Draft = { ...EMPTY_DRAFT, ...JSON.parse(raw) };
      const rankings: Record<string, string[]> = {};
      Object.keys(draft.rankings || {}).forEach((qid) => (rankings[qid] = (draft.rankings[qid] || []).slice(0, TOP_N)));
      return { ...draft, rankings };
    }
  } catch {
    // leeg concept
  }
  return EMPTY_DRAFT;
}

function saveDraft(playerId: string, draft: Draft) {
  try {
    storage()?.setItem(`rts:draft:${playerId}`, JSON.stringify(draft));
  } catch {
    // opslaan in de browser is een extraatje
  }
}

export default function VoteApp() {
  const { PLAYERS, QUESTIONS, playerById } = useGame();
  const storyDone = (d: Draft, qid: string) => (d.stories[qid] || "").trim().length >= STORY_MIN;
  const isComplete = (d: Draft, qid: string) => (d.rankings[qid] || []).length === TOP_N && storyDone(d, qid);
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<Status | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [qIndex, setQIndex] = useState(0);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/rankingthestars/status", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch {
      // offline: gewoon doorgaan
    }
  }, []);

  useEffect(() => {
    refreshStatus().finally(() => {
      const last = storage()?.getItem("rts:me");
      if (last && playerById(last)) {
        setMe(last);
        setDraft(loadDraft(last));
      }
      setPhase("intro");
    });
  }, [refreshStatus]);

  useEffect(() => {
    if (me) saveDraft(me, draft);
  }, [me, draft]);

  useEffect(() => {
    if (phase === "question" || phase === "review") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase, qIndex]);

  const question = QUESTIONS[qIndex];
  const ranking = useMemo(() => draft.rankings[question.id] || [], [draft, question.id]);
  const pool = PLAYERS.filter((p) => !ranking.includes(p.id));
  const completeCount = QUESTIONS.filter((q) => isComplete(draft, q.id)).length;
  const allComplete = completeCount === QUESTIONS.length;
  const alreadySubmitted = !!(me && status?.submitted.includes(me));
  const votingClosed = status ? !status.votingOpen : false;

  const setRanking = (next: string[]) =>
    setDraft((d) => ({ ...d, rankings: { ...d.rankings, [question.id]: next } }));

  const choosePlayer = (id: string) => {
    setMe(id);
    storage()?.setItem("rts:me", id);
    const loaded = loadDraft(id);
    setDraft(loaded);
    setError(null);
    const firstOpen = QUESTIONS.findIndex((q) => !isComplete(loaded, q.id));
    if (firstOpen === -1) {
      setPhase("review");
    } else {
      setQIndex(firstOpen);
      setPhase("question");
    }
  };

  const add = (id: string) => {
    if (ranking.length >= TOP_N) return;
    setLastAdded(id);
    setRanking([...ranking, id]);
  };
  const remove = (id: string) => setRanking(ranking.filter((x) => x !== id));
  const move = (index: number, dir: -1 | 1) => {
    const next = [...ranking];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setLastAdded(null);
    setRanking(next);
  };

  const submit = async () => {
    if (!me) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/rankingthestars/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: me, token: deviceToken(), ...draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Versturen mislukt.");
      await refreshStatus();
      setPhase("done");
      setConfetti((c) => c + 1);
    } catch (e: any) {
      setError(e.message || "Versturen mislukt.");
    } finally {
      setSending(false);
    }
  };

  const meName = me ? playerById(me)?.name : null;

  if (phase === "loading") {
    return (
      <main className="rts-wrap" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <Logo size={44} className="rts-float" />
      </main>
    );
  }

  if (votingClosed && phase !== "done") {
    return (
      <main className="rts-wrap" style={{ textAlign: "center", paddingTop: 48 }}>
        <Logo size={52} className="rts-float" />
        <div className="rts-card rts-pop" style={{ padding: 28, marginTop: 36 }}>
          <div style={{ fontSize: 56 }}>🔒</div>
          <h1 className="rts-display" style={{ fontSize: 28, marginTop: 8 }}>
            De stembus is dicht
          </h1>
          <p style={{ color: "var(--muted)", marginTop: 10 }}>
            Alle stemmen zijn geteld. De uitslag zie je tijdens de show. Spannend!
          </p>
        </div>
      </main>
    );
  }

  if (phase === "intro") {
    return (
      <main className="rts-wrap" style={{ textAlign: "center", paddingTop: 40 }}>
        <Logo size={58} className="rts-float" />
        <p className="rts-display" style={{ marginTop: 22, color: "var(--pink)", fontSize: 18, letterSpacing: "0.08em" }}>
          DE GROTE COLLEGA-EDITIE
        </p>
        <div className="rts-card rts-pop" style={{ padding: "24px 22px", marginTop: 24, maxWidth: 560, marginInline: "auto" }}>
          <h1 className="rts-display" style={{ fontSize: 24 }}>
            Zo werkt het
          </h1>
          <ol className="rts-steps" style={{ marginTop: 18 }}>
            <li>
              <b>1</b>
              <span>Kies wie je bent.</span>
            </li>
            <li>
              <b>2</b>
              <span>
                Kies per vraag jouw <strong>top 3</strong>: wie past er het állerbeste bij? Nummer 1 krijgt{" "}
                {POINTS[0]} punten, nummer 2 krijgt {POINTS[1]} en nummer 3 krijgt {POINTS[2]}. Jezelf kiezen mag ook!
              </span>
            </li>
            <li>
              <b>3</b>
              <span>
                Vertel bij elke vraag het verhaal achter je nummer 1. Anoniem, maar het komt wél op het grote scherm. 🤫
              </span>
            </li>
          </ol>
          <p style={{ marginTop: 16, color: "var(--muted)", fontSize: 14 }}>
            {QUESTIONS.length} vragen · ongeveer 5 minuten · je kunt tussendoor stoppen, we onthouden alles.
          </p>
        </div>
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          {me && meName ? (
            <>
              <button className="rts-btn" onClick={() => choosePlayer(me)}>
                Verder als {meName} ⭐
              </button>
              <button className="rts-link" onClick={() => setPhase("who")}>
                Ik ben iemand anders
              </button>
            </>
          ) : (
            <button className="rts-btn" onClick={() => setPhase("who")}>
              Ik doe mee ⭐
            </button>
          )}
        </div>
      </main>
    );
  }

  if (phase === "who") {
    return (
      <main className="rts-wrap" style={{ paddingTop: 28 }}>
        <div style={{ textAlign: "center" }}>
          <Logo size={34} />
          <h1 className="rts-display" style={{ fontSize: "clamp(1.8rem, 6vw, 2.6rem)", marginTop: 24 }}>
            Wie ben jij?
          </h1>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>Tik op je eigen naam.</p>
        </div>
        <div className="rts-players" style={{ marginTop: 24 }}>
          {PLAYERS.map((p, i) => (
            <button
              key={p.id}
              className="rts-player rts-pop"
              style={{ animationDelay: `${i * 0.04}s` }}
              onClick={() => choosePlayer(p.id)}
            >
              {status?.submitted.includes(p.id) && <span className="rts-player__done">✓ gestemd</span>}
              <Avatar player={p} size={64} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="rts-wrap" style={{ textAlign: "center", paddingTop: 48 }}>
        <Confetti fire={confetti} />
        <div style={{ fontSize: 88 }} className="rts-float">
          🌟
        </div>
        <h1 className="rts-display rts-pop" style={{ fontSize: "clamp(2rem, 8vw, 3.2rem)", marginTop: 8 }}>
          Je stem is binnen!
        </h1>
        <p style={{ fontSize: 18, marginTop: 12, color: "var(--muted)" }}>
          Dankjewel{meName ? `, ${meName}` : ""}. Tot op de show. En niks verklappen hè 🤫
        </p>
        <div style={{ marginTop: 28 }}>
          <button className="rts-btn rts-btn--ghost rts-btn--small" onClick={() => setPhase("review")}>
            Toch nog iets aanpassen
          </button>
        </div>
      </main>
    );
  }

  const progress = (
    <div className="rts-topbar">
      <button className="rts-link rts-display rts-topbar__name" style={{ textDecoration: "none", fontSize: 13 }} onClick={() => setPhase("who")}>
        ⭐ {meName}
      </button>
      <nav className="rts-progress" aria-label="Vragen">
        {QUESTIONS.map((q, i) => (
          <button
            key={q.id}
            className={`${isComplete(draft, q.id) ? "is-done" : ""} ${phase === "question" && i === qIndex ? "is-current" : ""}`}
            onClick={() => {
              setQIndex(i);
              setPhase("question");
            }}
            aria-label={`Vraag ${i + 1}`}
          >
            ★
          </button>
        ))}
      </nav>
      <span className="rts-topbar__count" style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>
        {completeCount}/{QUESTIONS.length}
      </span>
    </div>
  );

  if (phase === "review") {
    return (
      <main className="rts-wrap">
        {progress}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <h1 className="rts-display" style={{ fontSize: "clamp(1.7rem, 6vw, 2.4rem)" }}>
            Jouw stembiljet
          </h1>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>
            {allComplete ? "Alles ingevuld. Klaar om te versturen?" : "Er staan nog vragen open."}
          </p>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          {QUESTIONS.map((q, i) => {
            const order = draft.rankings[q.id] || [];
            const done = isComplete(draft, q.id);
            const story = draft.stories[q.id];
            return (
              <button
                key={q.id}
                className="rts-card rts-pop"
                style={{
                  animationDelay: `${i * 0.03}s`,
                  padding: "14px 16px",
                  textAlign: "left",
                  color: "#fff",
                  cursor: "pointer",
                  borderColor: done ? undefined : "rgba(255,46,136,.7)",
                }}
                onClick={() => {
                  setQIndex(i);
                  setPhase("question");
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span className="rts-display" style={{ color: CATEGORIES[q.category].color, fontSize: 18, width: 28 }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600, lineHeight: 1.3 }}>{q.question}</span>
                  {done ? (
                    <span style={{ display: "flex" }}>
                      {order.slice(0, 3).map((id, k) => (
                        <Avatar
                          key={id}
                          player={playerById(id)!}
                          size={30}
                          style={{ marginLeft: k ? -8 : 0, zIndex: 3 - k }}
                        />
                      ))}
                    </span>
                  ) : (
                    <span style={{ color: "var(--pink)", fontWeight: 700, fontSize: 14 }}>open</span>
                  )}
                </div>
                {story && (
                  <p style={{ marginTop: 8, marginLeft: 40, fontSize: 14, color: "var(--muted)", fontStyle: "italic" }}>
                    “{story.length > 110 ? story.slice(0, 110) + "…" : story}”
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {alreadySubmitted && (
          <p style={{ marginTop: 16, color: "var(--muted)", fontSize: 14, textAlign: "center" }}>
            Je hebt al eerder gestemd. Opnieuw versturen overschrijft je vorige stem.
          </p>
        )}
        {error && (
          <div className="rts-error" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        <div className="rts-bottombar">
          <div className="rts-bottombar__inner">
            <button
              className="rts-btn rts-btn--ghost rts-btn--small"
              onClick={() => {
                setQIndex(QUESTIONS.length - 1);
                setPhase("question");
              }}
            >
              ← Terug
            </button>
            <button className="rts-btn rts-btn--pink" disabled={!allComplete || sending} onClick={submit}>
              {sending ? "Versturen…" : alreadySubmitted ? "Stem bijwerken 🚀" : "Verstuur mijn stem 🚀"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Vraagscherm
  const category = CATEGORIES[question.category];
  const rankingDone = ranking.length === TOP_N;
  const complete = rankingDone && storyDone(draft, question.id);
  const number1 = ranking[0] ? playerById(ranking[0]) : null;
  const story = draft.stories[question.id] || "";

  return (
    <main className="rts-wrap">
      {progress}

      <section key={question.id} className="rts-card rts-question rts-pop">
        <span className="rts-chip" style={{ ["--chip" as string]: category.color }}>
          {category.emoji} {category.label}
        </span>
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)", letterSpacing: "0.1em" }}>
          VRAAG {qIndex + 1} VAN {QUESTIONS.length}
        </div>
        <h2 className="rts-display">{question.question}</h2>
      </section>

      <div className="rts-rank-grid">
        <section className="rts-card rts-list" aria-label="Jouw top 3">
          <div className="rts-display" style={{ fontSize: 17, padding: "4px 4px 6px" }}>
            Jouw top 3
          </div>
          {ranking.map((id, i) => {
            const p = playerById(id)!;
            return (
              <div key={id} className={`rts-row ${id === lastAdded ? "is-new" : ""}`}>
                <span className={`rts-rankno rts-rankno--${i + 1}`}>{i + 1}</span>
                <Avatar player={p} size={34} />
                <span className="rts-row__name">
                  {p.name}
                  {p.id === me && <span style={{ fontSize: 11, color: "var(--gold)" }}> (jij)</span>}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{POINTS[i]} pt</span>
                <button className="rts-iconbtn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Omhoog">
                  ▲
                </button>
                <button
                  className="rts-iconbtn"
                  disabled={i === ranking.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Omlaag"
                >
                  ▼
                </button>
                <button className="rts-iconbtn" onClick={() => remove(id)} aria-label="Verwijderen">
                  ✕
                </button>
              </div>
            );
          })}
          {Array.from({ length: TOP_N - ranking.length }, (_, k) => {
            const pos = ranking.length + k + 1;
            return (
              <div key={`empty-${pos}`} className={`rts-row rts-row--empty ${k === 0 ? "rts-row--next" : ""}`}>
                <span className="rts-rankno" style={{ background: "transparent" }}>
                  {pos}
                </span>
                <span>{k === 0 ? "kies hieronder iemand ↓" : ""}</span>
              </div>
            );
          })}
        </section>

        <section className="rts-card rts-pool">
          {ranking.length < TOP_N ? (
            <>
              <div className="rts-display" style={{ fontSize: 17 }}>
                Wie is jouw <span style={{ color: "var(--gold)" }}>#{ranking.length + 1}</span>?
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                {ranking.length === 0
                  ? "Tik op wie het állerbeste bij deze vraag past."
                  : `Tik op een naam. Nog ${TOP_N - ranking.length} te kiezen.`}
              </p>
              <div className="rts-pool__chips">
                {pool.map((p) => (
                  <button key={p.id} className="rts-namechip" onClick={() => add(p.id)}>
                    <Avatar player={p} size={32} />
                    {p.name}
                    {p.id === me && <span style={{ fontSize: 11, color: "var(--gold)" }}>(jij)</span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 36 }}>🏆</div>
              <div className="rts-display" style={{ fontSize: 17, marginTop: 4 }}>
                Top 3 compleet!
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                Wisselen? Schuif met de pijltjes of tik op ✕ om iemand te vervangen.
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="rts-card rts-story">
        <label htmlFor="story" className="rts-display" style={{ fontSize: 17, display: "block" }}>
          🎤 Vertel het verhaal
        </label>
        <p style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}>
          {number1 ? (
            <>
              Over jouw nummer 1, <strong style={{ color: "#fff" }}>{number1.name}</strong>: {question.storyPrompt}
            </>
          ) : (
            <>Kies eerst je nummer 1. {question.storyPrompt}</>
          )}
        </p>
        <textarea
          id="story"
          className="rts-input"
          rows={3}
          maxLength={STORY_MAX}
          style={{ marginTop: 10, resize: "vertical" }}
          placeholder="Hoe sappiger, hoe beter. Het komt anoniem op het grote scherm."
          value={story}
          onChange={(e) =>
            setDraft((d) => ({ ...d, stories: { ...d.stories, [question.id]: e.target.value } }))
          }
        />
        <div style={{ textAlign: "right", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          {story.trim().length < STORY_MIN
            ? `Verplicht · nog ${STORY_MIN - story.trim().length} ${STORY_MIN - story.trim().length === 1 ? "teken" : "tekens"}`
            : `${story.length}/${STORY_MAX} ✓`}
        </div>
      </section>

      <div className="rts-bottombar">
        <div className="rts-bottombar__inner">
          <button
            className="rts-btn rts-btn--ghost rts-btn--small"
            onClick={() => (qIndex === 0 ? setPhase("who") : setQIndex(qIndex - 1))}
          >
            ← Vorige
          </button>
          <button
            className="rts-btn"
            disabled={!complete}
            onClick={() => {
              setLastAdded(null);
              if (qIndex === QUESTIONS.length - 1 || allComplete) {
                const nextOpen = QUESTIONS.findIndex((q, i) => i > qIndex && !isComplete(draft, q.id));
                if (nextOpen === -1) setPhase("review");
                else setQIndex(nextOpen);
              } else {
                setQIndex(qIndex + 1);
              }
            }}
          >
            {complete
              ? qIndex === QUESTIONS.length - 1 || allComplete
                ? "Naar overzicht →"
                : "Volgende →"
              : !rankingDone
                ? `Nog ${TOP_N - ranking.length} te kiezen`
                : "Vul het verhaal in"}
          </button>
        </div>
      </div>
    </main>
  );
}
