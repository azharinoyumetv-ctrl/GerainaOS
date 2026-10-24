const { loadTestConfig } = require('./test-config.cjs');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
(async () => {
  const config = loadTestConfig();
  const response = await fetch(`${config.base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DagangOS-Module': 'geraina' },
    body: JSON.stringify({ email: config.email, password: config.password }), signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new Error(`Geraina test sign-in was rejected (HTTP ${response.status}). Password and response contents are hidden.`);
  const session = await response.json();
  if (!session.access_token) throw new Error('Sign-in did not return a session token.');
  const headers = { Authorization: `Bearer ${session.access_token}`, 'X-DagangOS-Module': 'geraina' };
  const meResponse = await fetch(`${config.base}/api/auth/me`, { headers, signal: AbortSignal.timeout(60000) });
  if (!meResponse.ok) throw new Error(`Account verification failed (HTTP ${meResponse.status}).`);
  const me = await meResponse.json();
  if (me.store_name !== config.store) throw new Error('The active store differs from the configured test store; no tests will modify data.');
  const productsResponse = await fetch(`${config.base}/api/products`, { headers, signal: AbortSignal.timeout(60000) });
  const products = productsResponse.ok ? await productsResponse.json() : null;
  const report = { checkedAt: new Date().toISOString(), status: 'passed', store: me.store_name,
    role: me.role, plan: me.plan, products: Array.isArray(products) ? products.length : null,
    productsHttpStatus: productsResponse.status, allowWrites: config.allowWrites,
    credentials: 'loaded from local ignored file; excluded from reports' };
  const reportDir = join(__dirname, '../app/build/reports/android-bench');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, 'account-preflight.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
