import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// Signed-in tests read a test account from .env.test.local (gitignored):
//   E2E_EMAIL=...
//   E2E_PASSWORD=...
if (existsSync(".env.test.local")) {
  for (const line of readFileSync(".env.test.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5180";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    channel: "chrome", // use the installed Chrome; no browser download needed
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  // Reuses the dev server if it is already running.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "node node_modules/vite/bin/vite.js --port 5180 --strictPort", url: BASE_URL, reuseExistingServer: true, timeout: 60_000 },
});
