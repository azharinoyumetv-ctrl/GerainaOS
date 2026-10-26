const { test, expect } = require('@playwright/test');
const { fixture, scenarios } = require('../../android-app/scripts/verify-remaining-pos.cjs');

for (const scenario of scenarios) {
  test(scenario.name, async ({ browser }, testInfo) => {
    const f = await fixture(browser, testInfo.project.use.viewport, scenario.options);
    await f.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    let failed = false;
    try {
      await test.step(scenario.name, () => scenario.run(f));
      expect(f.errors, 'No uncaught application errors').toEqual([]);
      const screenshot = testInfo.outputPath('screen.png');
      await f.page.screenshot({ path: screenshot });
      await testInfo.attach('screen', { path: screenshot, contentType: 'image/png' });
    } catch (error) {
      failed = true;
      const screenshot = testInfo.outputPath('failure.png');
      await f.page.screenshot({ path: screenshot }).then(() => testInfo.attach('failure', { path: screenshot, contentType: 'image/png' })).catch(() => {});
      throw error;
    } finally {
      await testInfo.attach('isolated-requests', {
        body: Buffer.from(JSON.stringify({ merchantWrites: 0, requests: f.requests, isolatedWrites: f.writes.map(row => row.path), runtimeErrors: f.errors }, null, 2)),
        contentType: 'application/json',
      });
      if (failed) {
        const trace = testInfo.outputPath('trace.zip');
        await f.context.tracing.stop({ path: trace });
        await testInfo.attach('trace', { path: trace, contentType: 'application/zip' });
      } else await f.context.tracing.stop();
      await f.context.close();
    }
  });
}
