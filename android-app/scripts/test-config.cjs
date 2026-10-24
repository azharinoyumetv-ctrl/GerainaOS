const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function loadTestConfig() {
  const file = join(__dirname, '../../.env.android-test');
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  for (const key of ['GERAINA_TEST_EMAIL', 'GERAINA_TEST_PASSWORD', 'GERAINA_TEST_STORE']) {
    if (!values[key]) throw new Error(`Set ${key} in the ignored .env.android-test file.`);
  }
  const base = values.GERAINA_TEST_BASE_URL || 'https://dagangos.com';
  if (base !== 'https://dagangos.com') throw new Error('This test bench currently targets the official Geraina origin.');
  return { base, email: values.GERAINA_TEST_EMAIL, password: values.GERAINA_TEST_PASSWORD,
    store: values.GERAINA_TEST_STORE, allowWrites: values.GERAINA_TEST_ALLOW_WRITES === 'true' };
}
module.exports = { loadTestConfig };
