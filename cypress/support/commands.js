// Shared helpers for the Ria calculator tests.
// Locale: /es-cl/ (Spanish UI, Chile as sending country).
// Selectors are language-neutral on purpose (ids / attributes / href).
// NOTE: www.riamoneytransfer.com answers Cypress with a Cloudflare challenge (403), so the calculator
// helpers below could not be executed end to end in Cypress; they apply what Selenium/Playwright verified.
// Real (CDP) clicks/typing come from cypress-real-events.

export const SEND = '#amount-from';
export const RECEIVE = '#amount-to';
// The page always has two role=dialog nodes (a popover and the destination picker): use the shadcn data-slot.
export const DIALOG = '[role="dialog"][data-slot="dialog-content"]';
export const GET_STARTED = 'a[href="https://secure.riamoneytransfer.com/"]';

/** "3,350.82" or "3.350,82" -> 3350.82 (es-cl may use "." as thousands separator) */
export const toNumber = (text) => {
  const t = String(text).trim();
  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  const decimalSep = lastDot > lastComma ? '.' : ',';
  const normalized = t.replace(decimalSep === '.' ? /,/g : /\./g, '').replace(',', '.');
  return Number(normalized.replace(/[^\d.]/g, ''));
};

/** Destination button = the dialog trigger inside the "receive" card. */
export const destinationButton = () =>
  cy.get(RECEIVE).closest('.rounded-xl').find('button[aria-haspopup="dialog"]');

export const openCalculator = () => {
  cy.visit('/es-cl/');
  cy.get(SEND).should('be.visible');
  // The page is server-rendered and only becomes interactive after React hydrates: typing/clicking earlier
  // is ignored or reset. React marks hydrated nodes with __reactFiber$/__reactProps$ keys.
  cy.window().should((win) => {
    const el = win.document.querySelector(SEND);
    expect(el, 'send input').to.exist;
    expect(Object.keys(el).some((k) => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$')),
      'React hydrated').to.equal(true);
  });
};

/** Promo banner, e.g. "1 CLP = 0,131700 0,134033 HTG". Struck-through and promo rates sit in adjacent
 *  elements (textContent glues them, e.g. "3,1473,2491 COP"), so join the text nodes with spaces. */
export const rateText = (root) => {
  const doc = root.ownerDocument;
  const re = /1\s*CLP\s*=[\s\d.,]*\s[A-Z]{3}/;
  let best = null;
  root.querySelectorAll('*').forEach((el) => {
    const t = (el.textContent || '').trim();
    if (re.test(t) && (best === null || t.length < (best.textContent || '').trim().length)) best = el;
  });
  if (!best) return '';
  const walker = doc.createTreeWalker(best, NodeFilter.SHOW_TEXT);
  const parts = [];
  let n;
  while ((n = walker.nextNode())) { const v = n.textContent.trim(); if (v) parts.push(v); }
  return parts.join(' ');
};

/** Destination picker is two-level: country -> currency (Haiti -> HTG | USD). */
export const selectHaitiHTG = () => {
  destinationButton().realClick();
  cy.get(DIALOG).should('be.visible').contains(/Hait[ií]/).realClick();
  cy.get(DIALOG).contains('HTG').realClick();
  cy.get(DIALOG).should('not.be.visible'); // it stays in the DOM, hidden
  destinationButton().should('contain.text', 'HTG');
};

/** Replace the "You send" amount. */
export const setSendAmount = (value) => {
  cy.get(SEND).clear().realType(value);
};
