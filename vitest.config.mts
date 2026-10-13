import path from "path";
import { defineConfig } from "vitest/config";

// Vaste tijdzone, zodat lokale-tijd-berekeningen overal hetzelfde uitkomen.
process.env.TZ = "Europe/Amsterdam";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: { include: ["lib/taken/**"] },
  },
});
