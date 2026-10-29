// STEP 1 - diagnostic only (not part of the deliverable specs).
// Records what the server answers to Cypress, so we can tell WAF/bot rule vs. something else.
const URLS = [
  'https://www.riamoneytransfer.com/es-cl/',
  'https://www.riamoneytransfer.com/en-cl/',
  'https://secure.riamoneytransfer.com/login',
];

describe('STEP 1 - connectivity diagnostic', () => {
  URLS.forEach((url, i) => {
    it(`cy.request ${url}`, () => {
      cy.request({ url, failOnStatusCode: false }).then((res) => {
        cy.writeFile(`diagnostics/step1-request-${i}.json`, {
          url, status: res.status,
          headers: res.headers,
          bodyStart: String(res.body).slice(0, 600),
        });
      });
    });

    it(`cy.visit ${url}`, () => {
      cy.visit(url, { failOnStatusCode: false });
      cy.window().then((win) => {
        cy.writeFile(`diagnostics/step1-visit-${i}.json`, {
          url, title: win.document.title, location: win.location.href,
          navigator: { webdriver: win.navigator.webdriver, ua: win.navigator.userAgent },
          textStart: win.document.body.innerText.slice(0, 400),
        });
      });
      cy.wait(Number(Cypress.env('PAUSE')) || 0);
    });
  });
});
