import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright smoke Brand Platform (INSIGHTS §9).
 * Запуск локально: `npm run test` (требует backend:3000 + frontend:5173 + seed-user).
 * Запуск в CI: см. `.github/workflows/playwright.yml`.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // wizard — последовательная история (stage 1 → 2 → 3 → 4)
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
