// Playwright config verifikasi Geraina.
// Jalankan:  npx playwright test
// Override target:  PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 npx playwright test
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  // 15s was too tight for real production conditions: every hard navigation
  // (page.goto, which is what every route check in these specs does) re-validates
  // the session via a live GET /auth/me call before RoleGuard renders the actual
  // page (see RoleGuard.jsx's "auth-loading" gate + AuthContext.jsx's useEffect).
  // Vercel serverless cold starts occasionally push that round trip past 15s,
  // which showed up as ~50% of routes randomly failing with no pattern tied to
  // the route itself -- confirmed via the failure screenshots, which showed only
  // the auth-loading placeholder, not a crash or missing page.
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "https://dagangos.com",
    headless: true,
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
