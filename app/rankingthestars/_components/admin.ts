"use client";

// Kleine helpers voor de regiekamer en de show.

export function getPin(): string {
  try {
    return window.sessionStorage.getItem("rts:pin") || "";
  } catch {
    return "";
  }
}

export function setPin(pin: string) {
  try {
    if (pin) window.sessionStorage.setItem("rts:pin", pin);
    else window.sessionStorage.removeItem("rts:pin");
  } catch {
    // niet erg, dan vraagt de show opnieuw om de pincode
  }
}

export async function adminCall<T = any>(pin: string, action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/rankingthestars/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, action, ...extra }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "Er ging iets mis.") as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return data as T;
}
