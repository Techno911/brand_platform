import { defineConfig } from "vitest/config";

// Unit-тесты Brand Platform — только чистая логика без БД/сети.
// Интеграционные тесты (с PG, миграциями, сидом) — через docker compose + e2e Playwright.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts", "test/unit/**/*.spec.ts"],
    exclude: ["node_modules", "dist", "test/golden-set/**", "test/e2e/**"],
    reporters: ["verbose"],
    // Тесты не должны висеть на сетевых вызовах — 10 секунд на тест.
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
