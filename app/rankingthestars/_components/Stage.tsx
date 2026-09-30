// Studio-achtergrond: spotlights, podiumvloer en twinkelende sterren.
const TWINKLES = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 92,
  size: 8 + ((i * 7) % 14),
  delay: ((i * 0.37) % 3).toFixed(2),
}));

export default function Stage() {
  return (
    <div className="rts-bg" aria-hidden>
      <div className="rts-beam rts-beam--l" />
      <div className="rts-beam rts-beam--c" />
      <div className="rts-beam rts-beam--r" />
      {TWINKLES.map((t, i) => (
        <span
          key={i}
          className="rts-twinkle"
          style={{
            left: `${t.left}%`,
            top: `${t.top}%`,
            fontSize: t.size,
            animationDelay: `${t.delay}s`,
          }}
        >
          ✦
        </span>
      ))}
    </div>
  );
}
