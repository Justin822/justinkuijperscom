"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, STORY_MAX, type Player } from "@/lib/rankingthestars/types";
import { useGame } from "./GameContext";
import type { Results } from "@/lib/rankingthestars/results";
import Avatar from "./Avatar";
import Confetti from "./Confetti";
import Logo from "./Logo";
import PinGate from "./PinGate";
import { adminCall, getPin, setPin } from "./admin";
import { ding, drumroll, setMuted, tada, whoosh } from "./sound";

type AwardKey = "star" | "denial" | "ego";

type Slide =
  | { kind: "welcome" }
  | { kind: "empty" }
  | { kind: "question"; qi: number }
  | { kind: "board"; qi: number }
  | { kind: "stories"; qi: number }
  | { kind: "award"; award: AwardKey }
  | { kind: "finale" }
  | { kind: "end" };

type RevealStep = { from: number; drum?: boolean };

const MAX_QUOTES = 6;

// Onthullingsvolgorde van onder naar boven: per drie, dan 3, 2, tromgeroffel, 1.
function revealPlan(count: number): RevealStep[] {
  const plan: RevealStep[] = [{ from: count + 1 }];
  let t = count + 1;
  while (t > 4) {
    t = Math.max(4, t - 3);
    plan.push({ from: t });
  }
  if (count >= 3) plan.push({ from: 3 });
  if (count >= 2) plan.push({ from: 2 });
  plan.push({ from: Math.min(2, count + 1), drum: true });
  plan.push({ from: 1 });
  return plan;
}

const pts = (n: number) => `${n} ${n === 1 ? "punt" : "punten"}`;

const AWARDS: Record<AwardKey, { trophy: string; title: string }> = {
  star: { trophy: "🌟", title: "Ster van de avond" },
  denial: { trophy: "🙈", title: "Ontkenning van de avond" },
  ego: { trophy: "🪞", title: "Ster in eigen ogen" },
};

export default function ShowApp() {
  const { QUESTIONS } = useGame();
  const [pin, setPinState] = useState("");
  const [demo, setDemo] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState({ slide: 0, step: 0 });
  const [muted, setMutedState] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const direction = useRef<1 | -1>(1);
  const stopDrum = useRef<(() => void) | null>(null);

  const load = useCallback(async (usePin: string, useDemo: boolean) => {
    try {
      const data = await adminCall<Results>(usePin, "results", { demo: useDemo });
      setResults(data);
      setPin(usePin);
      setPinState(usePin);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      setPin("");
      setPinState("");
    }
  }, []);

  useEffect(() => {
    const isDemo = new URLSearchParams(window.location.search).get("demo") === "1";
    setDemo(isDemo);
    const saved = getPin();
    if (saved) load(saved, isDemo).finally(() => setReady(true));
    else setReady(true);
  }, [load]);

  const slides: Slide[] = useMemo(() => {
    if (!results) return [];
    if (!results.voters) return [{ kind: "welcome" }, { kind: "empty" }];
    const list: Slide[] = [{ kind: "welcome" }];
    results.questions.forEach((qr, qi) => {
      if (!qr.ranking.length) return;
      list.push({ kind: "question", qi }, { kind: "board", qi });
      if (qr.stories.length) list.push({ kind: "stories", qi });
    });
    (["denial", "ego", "star"] as AwardKey[]).forEach((award) => {
      if (results.awards[award]) list.push({ kind: "award", award });
    });
    if (results.leaderboard.length) list.push({ kind: "finale" });
    list.push({ kind: "end" });
    return list;
  }, [results]);

  const stepsOf = useCallback(
    (slide: Slide): number => {
      if (!results) return 1;
      switch (slide.kind) {
        case "board":
          return revealPlan(results.questions[slide.qi].ranking.length).length;
        case "stories":
          return Math.min(results.questions[slide.qi].stories.length, MAX_QUOTES) + 1;
        case "award":
          return 3;
        case "finale":
          return revealPlan(results.leaderboard.length).length + 1;
        default:
          return 1;
      }
    },
    [results]
  );

  const next = useCallback(() => {
    direction.current = 1;
    setPos((p) => {
      const slide = slides[p.slide];
      if (!slide) return p;
      if (p.step < stepsOf(slide) - 1) return { slide: p.slide, step: p.step + 1 };
      if (p.slide < slides.length - 1) return { slide: p.slide + 1, step: 0 };
      return p;
    });
  }, [slides, stepsOf]);

  const prev = useCallback(() => {
    direction.current = -1;
    setPos((p) => {
      if (p.step > 0) return { slide: p.slide, step: p.step - 1 };
      if (p.slide > 0) return { slide: p.slide - 1, step: stepsOf(slides[p.slide - 1]) - 1 };
      return p;
    });
  }, [slides, stepsOf]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  };

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      setMuted(!m);
      return !m;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        prev();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, toggleMute]);

  // Geluid en confetti bij elke stap (alleen vooruit)
  useEffect(() => {
    stopDrum.current?.();
    stopDrum.current = null;
    const slide = slides[pos.slide];
    if (!slide || !results || direction.current < 0) return;

    const celebrate = () => {
      tada();
      setConfetti((c) => c + 1);
    };

    if (slide.kind === "question" || (slide.kind === "finale" && pos.step === 0)) whoosh();
    if (slide.kind === "board" || (slide.kind === "finale" && pos.step > 0)) {
      const count = slide.kind === "board" ? results.questions[slide.qi].ranking.length : results.leaderboard.length;
      const step = revealPlan(count)[slide.kind === "board" ? pos.step : pos.step - 1];
      if (step.drum) stopDrum.current = drumroll();
      else if (step.from === 1) celebrate();
      else if (pos.step > (slide.kind === "board" ? 0 : 1)) ding(step.from <= 3 ? 1.5 : 1);
    }
    if (slide.kind === "stories" && pos.step > 0) ding(1.25);
    if (slide.kind === "award") {
      if (pos.step === 1) stopDrum.current = drumroll();
      if (pos.step === 2) celebrate();
    }
    if (slide.kind === "end") celebrate();
  }, [pos, slides, results]);

  useEffect(() => () => stopDrum.current?.(), []);

  if (!ready) return null;
  if (!pin || !results) {
    return (
      <PinGate
        title={demo ? "Generale repetitie" : "Start de show"}
        error={error}
        onSubmit={(p) => load(p, demo)}
      />
    );
  }

  const slide = slides[pos.slide];
  const questionDots = results.questions.map((_, qi) => slides.findIndex((s) => s.kind === "question" && s.qi === qi));
  const currentQuestion = "qi" in slide ? slide.qi : -1;

  return (
    <div className="show" onClick={next}>
      <Confetti fire={confetti} />
      {demo && <div className="demo-badge">GENERALE REPETITIE · NEPDATA</div>}

      <div className="show__slide" key={`${pos.slide}`}>
        <SlideView slide={slide} step={pos.step} results={results} />
      </div>

      <footer className="show__footer" onClick={(e) => e.stopPropagation()}>
        <span>
          {"qi" in slide ? `Vraag ${slide.qi + 1} van ${QUESTIONS.length}` : "Ranking the Stars"} · spatie / → volgende
        </span>
        <nav className="show__dots">
          {questionDots.map((index, qi) =>
            index < 0 ? null : (
              <button
                key={qi}
                title={`Vraag ${qi + 1}`}
                className={qi === currentQuestion ? "is-current" : index < pos.slide ? "is-past" : ""}
                onClick={() => {
                  direction.current = 1;
                  setPos({ slide: index, step: 0 });
                }}
              />
            )
          )}
        </nav>
        <span className="show__tools">
          <button onClick={prev}>← terug</button>
          <button onClick={toggleMute}>{muted ? "🔇 geluid uit" : "🔊 geluid aan"}</button>
          <button onClick={toggleFullscreen}>⛶ volledig scherm</button>
        </span>
      </footer>
    </div>
  );
}

function SlideView({ slide, step, results }: { slide: Slide; step: number; results: Results }) {
  const { PLAYERS, QUESTIONS, playerById, questionById } = useGame();
  const nameOf = (id: string) => playerById(id)?.name || "?";
  switch (slide.kind) {
    case "welcome":
      return (
        <>
          <Logo size="3.3em" className="show-enter" />
          <p className="rts-display show-sub" style={{ marginTop: "0.9em", color: "var(--pink)", letterSpacing: "0.1em" }}>
            DE GROTE COLLEGA-EDITIE
          </p>
          <div className="welcome-stars">
            {PLAYERS.map((p, i) => (
              <div key={p.id} style={{ animationDelay: `${0.4 + i * 0.08}s`, textAlign: "center" }}>
                <Avatar player={p} size="3.6em" />
                <div style={{ marginTop: "0.4em", fontWeight: 700, fontSize: "0.9em" }}>{p.name}</div>
              </div>
            ))}
          </div>
          <p className="show-sub" style={{ marginTop: "1.2em" }}>
            {results.voters} van de {PLAYERS.length} sterren brachten hun stem uit
          </p>
        </>
      );

    case "empty":
      return (
        <div className="show-enter">
          <div style={{ fontSize: "6em" }}>🗳️</div>
          <h1 className="rts-display show-h1">Nog geen stemmen</h1>
          <p className="show-sub" style={{ marginTop: "0.8em" }}>
            Zodra er gestemd is, verschijnt hier de uitslag.
          </p>
        </div>
      );

    case "question": {
      const q = QUESTIONS[slide.qi];
      const cat = CATEGORIES[q.category];
      return (
        <div className="show-enter" style={{ maxWidth: "62em" }}>
          <span className="rts-chip" style={{ ["--chip" as string]: cat.color, fontSize: "1em" }}>
            {cat.emoji} {cat.label}
          </span>
          <div className="rts-display show-qnum" style={{ marginTop: "0.25em" }}>
            {slide.qi + 1}
          </div>
          <h1 className="rts-display show-h1" style={{ marginTop: "0.3em" }}>
            {q.question}
          </h1>
        </div>
      );
    }

    case "board": {
      const q = QUESTIONS[slide.qi];
      const qr = results.questions[slide.qi];
      const plan = revealPlan(qr.ranking.length);
      const winner = qr.ranking[0];
      return (
        <RankBoard
          header={
            <>
              <span className="rts-chip" style={{ ["--chip" as string]: CATEGORIES[q.category].color }}>
                Vraag {slide.qi + 1}
              </span>
              <h2 className="rts-display show-h2" style={{ fontSize: "2em", marginTop: "0.4em", maxWidth: "36em" }}>
                {q.question}
              </h2>
            </>
          }
          rows={qr.ranking.map((r) => ({
            id: r.id,
            rank: r.rank,
            meta: r.firstVotes ? `${pts(r.points)} · ${r.firstVotes}× #1` : pts(r.points),
          }))}
          plan={plan}
          step={step}
          spotlight={
            <Spotlight
              player={playerById(winner.id)!}
              badge="#1"
              title={q.question}
              subtitle={
                winner.firstVotes
                  ? `${winner.firstVotes} van de ${qr.voters} zetten ${nameOf(winner.id)} op nummer 1 · ${pts(winner.points)}`
                  : pts(winner.points)
              }
            />
          }
        />
      );
    }

    case "stories": {
      const q = QUESTIONS[slide.qi];
      const qr = results.questions[slide.qi];
      const quotes = qr.stories.slice(0, MAX_QUOTES);
      const shown = quotes.slice(0, step);
      // Hoe meer tekst, hoe kleiner de letter, zodat alle verhalen passen.
      const total = quotes.reduce((sum, s) => sum + Math.min(s.text.length, STORY_MAX), 0);
      const quoteSize = total > 1100 ? "0.72em" : total > 700 ? "0.85em" : "1em";
      return (
        <>
          <div className="show-enter">
            <div className="rts-display show-h1" style={{ fontSize: step ? "2.6em" : "4.2em", transition: "font-size .4s" }}>
              🎤 Waarom dan?
            </div>
            <p className="show-sub" style={{ marginTop: "0.4em" }}>
              {q.question}
            </p>
          </div>
          <div className="quotes" style={{ fontSize: quoteSize }}>
            {shown.map((s, i) => {
              const about = playerById(s.aboutId);
              const text = s.text.slice(0, STORY_MAX);
              return (
                <div key={i} className="quote">
                  <div className="quote__text">“{text}”</div>
                  {about && (
                    <div className="quote__about">
                      <Avatar player={about} size="1.8em" /> over {about.name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      );
    }

    case "award": {
      const meta = AWARDS[slide.award];
      const award = results.awards[slide.award]!;
      const q = "questionId" in award ? questionById(award.questionId) : undefined;
      let teaser = "";
      if (slide.award === "star" && "points" in award) {
        teaser = `Voor de collega die over alle vragen samen de meeste punten binnensleepte: ${pts(award.points)}. Of dat een compliment is? Dat laten we in het midden.`;
      } else if (slide.award === "denial" && q && "points" in award) {
        teaser = `Won “${q.question}” met ${pts(award.points)}… maar zette zichzelf niet eens in de eigen top 3!`;
      } else if (slide.award === "ego" && "count" in award) {
        teaser = `Voor de collega die zichzelf het vaakst in de eigen top 3 zette: ${award.count} keer. Eerlijk is eerlijk.`;
      }
      return (
        <>
        <div className="award show-enter">
          <div className="award__trophy rts-float">{meta.trophy}</div>
          <h1 className="rts-display show-h1">{meta.title}</h1>
          <p className="award__teaser">{teaser}</p>
          {step >= 1 && (
            <div className="rts-display show-h2 drum" style={{ color: "var(--pink)", marginTop: "0.6em" }}>
              En de award gaat naar…
            </div>
          )}
        </div>
        {step >= 2 && (
          <Spotlight player={playerById(award.id)!} badge={meta.trophy} title={meta.title} subtitle={teaser} />
        )}
        </>
      );
    }

    case "finale": {
      if (step === 0) {
        return (
          <div className="show-enter" style={{ maxWidth: "60em" }}>
            <div style={{ fontSize: "7em" }} className="rts-float">
              👑
            </div>
            <h1 className="rts-display show-h1">Wie kent het team het best?</h1>
            <p className="show-sub" style={{ marginTop: "0.8em" }}>
              Stond jouw keuze op precies dezelfde plek in de top 3 van de groep? 3 punten. Wel in de top 3, maar op
              een andere plek? 1 punt. De winnaar mag zich vanavond de échte ster noemen.
            </p>
          </div>
        );
      }
      const plan = revealPlan(results.leaderboard.length);
      const winner = results.leaderboard[0];
      return (
        <RankBoard
          header={
            <h2 className="rts-display show-h2" style={{ fontSize: "2.4em" }}>
              👑 Eindklassement mensenkennis
            </h2>
          }
          rows={results.leaderboard.map((r, i) => ({
            id: r.id,
            rank: i + 1,
            meta: pts(r.score),
          }))}
          plan={plan}
          step={step - 1}
          spotlight={
            <Spotlight
              player={playerById(winner.id)!}
              badge="👑"
              title="Winnaar van Ranking the Stars"
              subtitle={`${pts(winner.score)} · ${winner.exact}× precies de juiste plek`}
            />
          }
        />
      );
    }

    case "end":
      return (
        <div className="show-enter">
          <div style={{ fontSize: "7em" }} className="rts-float">
            🥂
          </div>
          <h1 className="rts-display show-h1" style={{ fontSize: "6em" }}>
            Proost!
          </h1>
          <p className="show-sub" style={{ marginTop: "0.6em" }}>
            Bedankt voor het meespelen, sterren. Wat hier gezegd is, blijft hier. Nou ja… misschien.
          </p>
          <div className="welcome-stars">
            {PLAYERS.map((p, i) => (
              <div key={p.id} style={{ animationDelay: `${i * 0.06}s` }}>
                <Avatar player={p} size="3.6em" />
              </div>
            ))}
          </div>
        </div>
      );
  }
}

function RankBoard({
  header,
  rows,
  plan,
  step,
  spotlight,
}: {
  header: React.ReactNode;
  rows: { id: string; rank: number; meta: string }[];
  plan: RevealStep[];
  step: number;
  spotlight: React.ReactNode;
}) {
  const { playerById } = useGame();
  const current = plan[Math.min(step, plan.length - 1)];
  const previous = plan[Math.max(0, step - 1)];
  const perColumn = rows.length > 6 ? Math.ceil(rows.length / 2) : rows.length;

  return (
    <>
      <div className="show-enter">{header}</div>
      <div style={{ height: "3.4em", display: "grid", placeItems: "center" }}>
        {current.drum && (
          <div className="rts-display drum" style={{ fontSize: "2.4em", color: "var(--pink)" }}>
            En de nummer 1 is…
          </div>
        )}
      </div>
      <div
        className={`board ${rows.length <= 6 ? "board--single" : ""}`}
        style={rows.length > 6 ? { gridTemplateRows: `repeat(${perColumn}, auto)` } : undefined}
      >
        {rows.map((row) => {
          const revealed = row.rank >= current.from;
          const player = playerById(row.id)!;
          const delay = Math.max(0, previous.from - 1 - row.rank) * 0.35;
          return (
            <div
              key={row.id}
              className={[
                "board-row",
                revealed ? "is-revealed" : "is-hidden",
                revealed && row.rank <= 3 ? "is-top" : "",
                current.drum && row.rank === 1 ? "is-drum" : "",
              ].join(" ")}
              style={{ ["--delay" as string]: `${delay}s` }}
            >
              <span className={`rts-rankno ${row.rank <= 3 ? `rts-rankno--${row.rank}` : ""}`}>{row.rank}</span>
              {revealed ? (
                <>
                  <Avatar player={player} size="2.5em" />
                  <span className="board-row__name">{player.name}</span>
                  <span className="board-row__meta">{row.meta}</span>
                </>
              ) : (
                <span className="board-row__name">???</span>
              )}
            </div>
          );
        })}
      </div>
      {current.from === 1 && spotlight}
    </>
  );
}

function Spotlight({
  player,
  badge,
  title,
  subtitle,
}: {
  player: Player;
  badge: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="spotlight">
      <div className="spotlight__rays" />
      <div className="spotlight__avatar" style={{ position: "relative" }}>
        <Avatar player={player} size="12em" style={{ boxShadow: "0 0 0 0.035em var(--gold), 0 0 0.35em rgba(255,200,61,.6)" }} />
        <span className="spotlight__badge rts-display">{badge}</span>
      </div>
      <div className="rts-display spotlight__name">{player.name}</div>
      <p className="show-sub" style={{ marginTop: "0.6em", maxWidth: "40em", position: "relative" }}>
        {title}
      </p>
      <p
        style={{
          marginTop: "0.6em",
          fontSize: "1.3em",
          fontWeight: 700,
          color: "var(--gold)",
          maxWidth: "40em",
          position: "relative",
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}
