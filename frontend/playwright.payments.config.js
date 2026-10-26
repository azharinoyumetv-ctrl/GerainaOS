const path = require('node:path');
const base = require('./playwright.audit.config');
const output = path.resolve(__dirname, '../android-app/app/build/reports/payment-workflow/e2e');
module.exports = { ...base, testMatch: 'payment-workflow.spec.js', timeout: 60000,
  outputDir: path.join(output, 'artifacts'),
  reporter: [['list'], ['html', { outputFolder: path.join(output, 'report'), open: 'never' }], ['json', { outputFile: path.join(output, 'results.json') }]],
};
