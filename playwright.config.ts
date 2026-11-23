import { defineConfig, devices } from "@playwright/test";

// Browser tests for layout, RTL and animation bugs that `node --test` cannot see.
// Not part of `npm run check`: run with `npm run test:e2e` (see docs/research-ui-testing.md).
const port = 5179;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Own port so it never reuses another dev server by mistake.
    command: `npx vite dev --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    // The first dev compile is slow.
    timeout: 120_000,
  },
});
