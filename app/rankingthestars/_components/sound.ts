// Spelshow-geluidjes met de Web Audio API, zonder audiobestanden.

let context: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

function audio(): AudioContext | null {
  if (muted || typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  if (context.state === "suspended") context.resume();
  return context;
}

function noiseBuffer(ctx: AudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function tone(ctx: AudioContext, freq: number, start: number, duration: number, type: OscillatorType, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Tromgeroffel dat blijft rollen tot je de teruggegeven stop-functie aanroept. */
export function drumroll(): () => void {
  const ctx = audio();
  if (!ctx) return () => {};
  const buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.7;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.15, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 4);
  filter.connect(master).connect(ctx.destination);

  let next = ctx.currentTime + 0.02;
  const schedule = () => {
    while (next < ctx.currentTime + 0.25) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      const accent = 0.55 + Math.random() * 0.45;
      g.gain.setValueAtTime(accent, next);
      g.gain.exponentialRampToValueAtTime(0.01, next + 0.06);
      src.connect(g).connect(filter);
      src.start(next);
      src.stop(next + 0.07);
      next += 0.045;
    }
  };
  schedule();
  const timer = window.setInterval(schedule, 100);
  return () => {
    window.clearInterval(timer);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    // afsluitende bekkenslag
    const crash = ctx.createBufferSource();
    crash.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    crash.loop = true;
    crash.connect(hp).connect(g).connect(ctx.destination);
    crash.start();
    crash.stop(ctx.currentTime + 1.3);
  };
}

/** Fanfare voor een winnaar. */
export function tada() {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.05;
  const chord1 = [523.25, 659.25, 783.99];
  const chord2 = [587.33, 739.99, 880.0, 1174.66];
  chord1.forEach((f) => {
    tone(ctx, f, t, 0.18, "sawtooth", 0.06);
    tone(ctx, f, t + 0.2, 0.18, "sawtooth", 0.06);
  });
  chord2.forEach((f) => {
    tone(ctx, f, t + 0.42, 1.4, "sawtooth", 0.06);
    tone(ctx, f * 2, t + 0.42, 1.2, "triangle", 0.04);
  });
}

/** Kort belletje bij het omdraaien van een plek. */
export function ding(pitch = 1) {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  tone(ctx, 880 * pitch, t, 0.5, "sine", 0.18);
  tone(ctx, 1320 * pitch, t, 0.35, "sine", 0.08);
}

/** Zoef voor een nieuwe vraag. */
export function whoosh() {
  const ctx = audio();
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.5;
  const t = ctx.currentTime;
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.exponentialRampToValueAtTime(4000, t + 0.45);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.6);
}
