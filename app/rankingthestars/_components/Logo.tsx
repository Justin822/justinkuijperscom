export default function Logo({ size = 64, className = "" }: { size?: number | string; className?: string }) {
  return (
    <div className={`rts-marquee rts-display ${className}`} style={{ fontSize: size }}>
      <div className="rts-marquee__inner">
        <span className="rts-logo__small">RANKING</span>
        <span className="rts-logo__the">THE</span>
        <span className="rts-logo__big">STARS</span>
      </div>
    </div>
  );
}
