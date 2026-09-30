"use client";

import { useState } from "react";
import Logo from "./Logo";

// Inlogscherm voor de teamcode. Toont bewust geen namen of vragen.
export default function TeamGate() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rankingthestars/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Inloggen mislukt.");
      // Zelfde adres opnieuw laden: nu met toegang.
      if (window.location.pathname.endsWith("/toegang")) window.location.href = "/rankingthestars";
      else window.location.reload();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="rts-wrap" style={{ textAlign: "center", paddingTop: 48, maxWidth: 460 }}>
      <Logo size={48} className="rts-float" />
      <form className="rts-card rts-pop" style={{ padding: 26, marginTop: 36 }} onSubmit={submit}>
        <div style={{ fontSize: 48 }}>🎟️</div>
        <h1 className="rts-display" style={{ fontSize: 26, marginTop: 6 }}>
          Alleen voor sterren
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 15, marginTop: 8 }}>
          Vul de teamcode in die je van de spelleider hebt gekregen.
        </p>
        <input
          className="rts-input"
          type="password"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="Teamcode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ marginTop: 18, textAlign: "center", fontSize: 20, letterSpacing: "0.15em" }}
          autoFocus
        />
        {error && (
          <div className="rts-error" style={{ marginTop: 12, fontSize: 14 }}>
            {error}
          </div>
        )}
        <button className="rts-btn" type="submit" disabled={busy} style={{ marginTop: 18, width: "100%" }}>
          {busy ? "Even kijken…" : "Naar binnen ⭐"}
        </button>
      </form>
    </main>
  );
}
