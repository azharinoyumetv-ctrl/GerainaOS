const path = require('node:path');
const base = require('./playwright.audit.config');
const output = path.resolve(__dirname, '../android-app/app/build/reports/subscriptions/e2e');
module.exports = { ...base, testMatch: 'customer-subscriptions.spec.js', timeout: 45000,
  projects: [...base.projects, {name:'web-browser',use:{viewport:{width:1440,height:1000},nativeShell:false}}],
  outputDir: path.join(output, 'artifacts'),
  reporter: [['list'], ['html', { outputFolder: path.join(output, 'report'), open: 'never' }], ['json', { outputFile: path.join(output, 'results.json') }]],
};
