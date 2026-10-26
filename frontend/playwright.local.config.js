// Local CLI regression suite. All application/API traffic is intercepted by
// isolated fixtures; this config never runs the production registration specs.
const path = require('node:path');
const { defineConfig } = require('@playwright/test');
const output = path.resolve(__dirname, '../android-app/app/build/reports/playwright-cli');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['pos-local.spec.js', 'inventory-local.spec.js'],
  timeout: 45_000,
  expect: { timeout: 7_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  outputDir: path.join(output, 'artifacts'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(output, 'report'), open: 'never' }],
    ['json', { outputFile: path.join(output, 'results.json') }],
  ],
  use: { browserName: 'chromium', channel: 'chrome', headless: true },
  metadata: {
    scope: 'Prepared local Geraina frontend and Android presentation; isolated APIs and IndexedDB; no physical Android or real payment settlement',
    merchantWrites: 0,
  },
  projects: [
    { name: 'phone-layout', use: { viewport: { width: 412, height: 915 } } },
    { name: 'xiaomi-tablet-layout', use: { viewport: { width: 1016, height: 1100 } } },
    { name: 'samsung-tablet-layout', use: { viewport: { width: 1480, height: 924 } } },
  ],
});
