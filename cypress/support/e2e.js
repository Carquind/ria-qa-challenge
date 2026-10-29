import "cypress-real-events";
// Third-party scripts (analytics, chat widgets) throw errors unrelated to what we test.
Cypress.on('uncaught:exception', () => false);

// Evidence + pause after EVERY test (passed or failed).
// - screenshot of the whole Cypress runner (command log + page) -> screenshots/cypress/<spec>/
// - optional pause for a human to review the final screen. Usage: --env PAUSE=8000 (ms)
afterEach(function () {
  const t = this.currentTest;
  const name = `${t.state || 'run'}__${t.title}`.replace(/[^\w.-]+/g, '_').slice(0, 120);
  cy.screenshot(name, { capture: 'runner', overwrite: true });
  const pause = Number(Cypress.env('PAUSE')) || 0;
  if (pause > 0) cy.wait(pause);
});
