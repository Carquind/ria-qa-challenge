import { openCalculator, GET_STARTED } from '../support/commands';

const SECURE = 'https://secure.riamoneytransfer.com';
const REGISTER_LINK = 'a[href="/registration"]'; // "Register" is a link, not a button

// The cookie banner (class ria-gdpr-consent-manager-dialog) appears AFTER load
// and covers the page, but only on the first visit: the browser keeps the choice
// between tests (observed). So: wait for the form, give the banner a moment to
// show up, and close it only if it did.
const BANNER = '.ria-gdpr-consent-manager-dialog';
const rejectCookiesIfShown = () => {
  cy.get('input[type="password"]', { timeout: 40000 }).should('be.visible'); // SPA is slow on a cold cache
  cy.wait(2500); // grace period for the late banner
  cy.get('body').then(($body) => {
    if ($body.find(BANNER).length) {
      cy.get(BANNER).contains('button', /rechazar|reject|decline/i).click();
      cy.get(BANNER).should('not.exist');
    }
  });
};

// ---------------------------------------------------------------------------
// A. Direct to the secure site. www.riamoneytransfer.com is behind a Cloudflare
//    bot challenge for automated browsers (403 "Just a moment...", verified
//    with cypress/diagnostics/step1-connect.cy.js), but secure.* answers 200.
// ---------------------------------------------------------------------------
describe('Secure site (direct visit)', () => {
  beforeEach(() => {
    cy.visit(`${SECURE}/`); // redirects to /login
    cy.location('hostname').should('eq', 'secure.riamoneytransfer.com');
    rejectCookiesIfShown();
  });

  it('shows Register, phone/email and password', () => {
    cy.get('input[autocomplete="username"]').should('be.visible');   // phone or email
    cy.get('input[type="password"]').should('be.visible');
    cy.get(REGISTER_LINK).should('be.visible');
  });

  it('Register link navigates to /registration', () => {
    cy.get(REGISTER_LINK).click();
    cy.location('pathname').should('eq', '/registration');
  });

  // Acceptance criterion: Register -> country selection page.
  // Observed 2026-10-28 from a Chile IP: /registration shows the modal
  // "Unable to register account - based on your current location you cannot
  // register an account for Chile". That is a product geo-restriction, so from
  // Chile this test cannot see the country page. It fails with an explicit
  // message instead of a generic timeout. Run from a supported location (and
  // only if the reviewers confirm that is acceptable).
  it('shows the country selection page after Register', () => {
    cy.get(REGISTER_LINK).click();
    cy.location('pathname').should('eq', '/registration');
    cy.get('body').should(($body) => {
      const txt = $body.text();
      if (/cannot register an account|no puedes registrar una cuenta/i.test(txt)) {
        throw new Error('GEO-BLOCKED: registration is not available from this location (Chile). Not a test bug.');
      }
      expect(txt).to.match(/select (your )?country|country of residence|elige (tu )?pa[ií]s|selecciona (tu )?pa[ií]s/i);
    });
  });
});

// ---------------------------------------------------------------------------
// B. Full flow starting from the calculator. Needs www.* to be reachable by
//    automation (currently blocked by Cloudflare) - fails at cy.visit until then.
// ---------------------------------------------------------------------------
describe('Calculator "Get Started" -> secure.riamoneytransfer.com', () => {
  it('Get Started lands on secure.riamoneytransfer.com', () => {
    openCalculator();
    cy.get(GET_STARTED).first().scrollIntoView().should('be.visible').click();
    cy.origin(SECURE, () => {
      cy.location('hostname').should('eq', 'secure.riamoneytransfer.com');
    });
  });
});
