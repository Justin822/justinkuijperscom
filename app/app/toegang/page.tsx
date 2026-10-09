"use client";

import { useState } from "react";

// Inlogscherm. Na inloggen blijft de app 180 dagen open op dit apparaat.
export default function AccessPage() {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/taken/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Inloggen mislukt.");
      if (window.location.pathname.endsWith("/toegang")) window.location.href = "/app";
      else window.location.reload();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <form className="tk-card p-6" onSubmit={submit}>
        <h1 className="tk-h1">Taken</h1>
        <p className="tk-muted mt-1 text-sm">Alleen voor Justin.</p>
        <input
          className="tk-input mt-5"
          type="password"
          autoComplete="current-password"
          placeholder="Wachtwoord"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
        />
        {error && (
          <div className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        )}
        <button className="tk-btn mt-4 w-full" type="submit" disabled={busy}>
          {busy ? "Even kijken…" : "Inloggen"}
        </button>
      </form>
    </main>
  );
}
