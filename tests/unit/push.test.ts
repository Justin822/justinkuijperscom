import { describe, expect, it } from "vitest";
import { subscriptionId, validSubscription } from "@/lib/taken/push";

describe("validSubscription", () => {
  it("accepteert een gewoon abonnement van de browser", () => {
    const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "BNc", auth: "xyz" } };
    expect(validSubscription(sub)).toEqual(sub);
    expect(subscriptionId(sub.endpoint)).toHaveLength(24);
  });

  it("weigert rommel en niet-https", () => {
    expect(validSubscription({ endpoint: "http://evil/x", keys: { p256dh: "a", auth: "b" } })).toBeNull();
    expect(validSubscription({ endpoint: "https://x/y" })).toBeNull();
    expect(validSubscription(null)).toBeNull();
  });
});
