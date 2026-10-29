const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'https://www.riamoneytransfer.com',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1366,
    viewportHeight: 768,
    defaultCommandTimeout: 15000,
    pageLoadTimeout: 60000,
    video: false,
    screenshotsFolder: 'screenshots/cypress',
    trashAssetsBeforeRuns: false, // avoids the harmless 'failed to trash' (spawn -86) warning on macOS
    retries: { runMode: 0, openMode: 0 }, // failures are deterministic here; avoids duplicate 'attempt 2' evidence
    screenshotOnRunFailure: false, // support/e2e.js afterEach takes the screenshot of every test (pass or fail)
  },
});
