const path = require('node:path');
const base = require('./playwright.audit.config');
const output = path.resolve(__dirname, '../android-app/app/build/reports/product-categories');
module.exports = {
  ...base,
  testMatch: 'product-categories-local.spec.js',
  outputDir: path.join(output, 'artifacts'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(output, 'report'), open: 'never' }],
    ['json', { outputFile: path.join(output, 'results.json') }],
  ],
};
