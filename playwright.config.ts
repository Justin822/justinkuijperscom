import { defineConfig, devices } from "@playwright/test";
import os from "os";
import path from "path";

// End-to-end-tests van de Planner tegen een productie-build met bestandsopslag (geen Redis, geen Google).
const PORT = 3100;
export const DATA_FILE = path.join(os.tmpdir(), `planner-e2e-${process.pid}.json`);
export const PASSWORD = "e2e-wachtwoord";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "nl-NL",
    timezoneId: "Europe/Amsterdam",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "telefoon", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: {
      TAKEN_PASSWORD: PASSWORD,
      TAKEN_DATA_FILE: DATA_FILE,
      KV_REST_API_URL: "",
      KV_REST_API_TOKEN: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
  },
});
