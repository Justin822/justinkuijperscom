"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#ffc83d", "#ff2e88", "#27e1ff", "#9b6bff", "#1ed891", "#ffffff"];

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  star: boolean;
};

// Confetti-kanon. Elke keer dat `fire` verandert (en > 0 is) knalt het.
export default function Confetti({ fire }: { fire: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pieces = useRef<Piece[]>([]);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (!fire) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const burst = (originX: number, dir: number) => {
      for (let i = 0; i < 110; i++) {
        const angle = (-Math.PI / 2) + dir * (Math.random() * 0.9) + (Math.random() - 0.5) * 0.5;
        const speed = 9 + Math.random() * 12;
        pieces.current.push({
          x: originX,
          y: h + 10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 1.35,
          size: 6 + Math.random() * 8,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          star: Math.random() < 0.18,
        });
      }
    };
    burst(w * 0.1, 1);
    burst(w * 0.9, -1);
    burst(w * 0.5, 0);

    const drawStar = (size: number) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? size : size / 2.3;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      pieces.current = pieces.current.filter((p) => p.y < h + 40);
      for (const p of pieces.current) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.star) drawStar(p.size);
        else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 + Math.abs(Math.sin(p.rot)) * p.size * 0.5);
        ctx.restore();
      }
      if (pieces.current.length) frame.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
  }, [fire]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 50 }}
    />
  );
}
