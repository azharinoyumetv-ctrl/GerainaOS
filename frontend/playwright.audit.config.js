const path = require('node:path');
const { defineConfig } = require('@playwright/test');
const output = path.resolve(__dirname, '../android-app/app/build/reports/customer-audit');
module.exports = defineConfig({
  testDir: './tests', testMatch: 'customer-audit.spec.js', workers: 1, retries: 0,
  timeout: 30000, expect: { timeout: 4000 },
  outputDir: path.join(output, 'artifacts'),
  reporter: [['list'], ['html', { outputFolder: path.join(output,'report'), open:'never' }], ['json',{outputFile:path.join(output,'results.json')}]],
  use: { browserName:'chromium', channel:'chrome', headless:true, screenshot:'only-on-failure', trace:'retain-on-failure' },
  projects: [
    {name:'phone',use:{viewport:{width:412,height:915}}},
    {name:'xiaomi-tablet',use:{viewport:{width:1016,height:1100}}},
    {name:'samsung-tablet',use:{viewport:{width:1480,height:924}}},
  ],
});
