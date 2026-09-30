"use client";

import { useState } from "react";
import Logo from "./Logo";

export default function PinGate({
  title,
  error,
  onSubmit,
}: {
  title: string;
  error?: string | null;
  onSubmit: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");
  return (
    <main className="rts-wrap" style={{ textAlign: "center", paddingTop: 48, maxWidth: 440 }}>
      <Logo size={40} />
      <form
        className="rts-card rts-pop"
        style={{ padding: 24, marginTop: 32 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (pin) onSubmit(pin);
        }}
      >
        <div style={{ fontSize: 44 }}>🎬</div>
        <h1 className="rts-display" style={{ fontSize: 24, marginTop: 6 }}>
          {title}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>Alleen voor de spelleider.</p>
        <input
          className="rts-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Pincode"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ marginTop: 18, textAlign: "center", fontSize: 22, letterSpacing: "0.3em" }}
          autoFocus
        />
        {error && (
          <div className="rts-error" style={{ marginTop: 12, fontSize: 14 }}>
            {error}
          </div>
        )}
        <button className="rts-btn" type="submit" style={{ marginTop: 18, width: "100%" }}>
          Naar binnen
        </button>
      </form>
    </main>
  );
}
