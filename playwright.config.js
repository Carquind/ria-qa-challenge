const { defineConfig } = require('@playwright/test');

// Chrome (the installed one) with DEFAULT launch options on purpose: no stealth, no header spoofing.
// Evidence: screenshots/playwright/ (one per test), evidence/latest/playwright-* (report, json, traces of failures).
module.exports = defineConfig({
  testDir: './playwright/tests',
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1, // one browser at a time: do not hammer the site
  retries: 0, // failures here are deterministic (see README)
  reporter: [
    ['list'],
    ['html', { outputFolder: 'evidence/latest/playwright-report', open: 'never' }],
    ['json', { outputFile: 'evidence/latest/playwright-results.json' }],
  ],
  outputDir: 'evidence/latest/playwright-test-results',
  use: {
    channel: 'chrome', // uses the Chrome installed on the machine (no browser download needed)
    headless: false,
    viewport: { width: 1366, height: 900 },
    screenshot: 'off', // custom per-test screenshot in afterEach (pass or fail)
    trace: 'retain-on-failure',
  },
});
