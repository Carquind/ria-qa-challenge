import {
  SEND, RECEIVE, DIALOG,
  toNumber, openCalculator, selectHaitiHTG, setSendAmount, destinationButton, rateText,
} from '../support/commands';

describe('Ria calculator (home page) - CLP -> Haiti HTG', () => {
  beforeEach(() => {
    openCalculator();
  });

  describe('1. "You send" amount validation', () => {
    it('does not accept alphabet characters in the amount field', () => {
      setSendAmount('abc');
      cy.get(SEND).should('have.value', '');
    });

    // Acceptance criterion from the brief. Observed on 2026-10-28 (Chrome, Chile): typing
    // letters is silently discarded and NO message is rendered, so this test is
    // expected to FAIL until the product shows the message. It is a real finding
    // for the developer, not a flaky selector: the only validation text in the
    // DOM is the sr-only hint "Enter an amount between 1-10000000 CLP."
    it('shows "Please enter a valid amount" when letters are entered', () => {
      setSendAmount('abc');
      cy.get(SEND).blur();
      // ES wording on /es-cl/ is SIN CONFIRMAR; the brief's EN text is kept as an alternative.
      cy.contains(/Please enter a valid amount|monto v[aá]lido|importe v[aá]lido/i).should('be.visible');
    });
  });

  describe('2. "Send to" dropdown', () => {
    it('lets the user pick a destination country', () => {
      destinationButton().click();
      cy.get(DIALOG).should('be.visible');
      cy.get(DIALOG).find('input[type="search"]').should('be.visible');
      cy.get(DIALOG).find('[role="option"]').should('have.length.greaterThan', 1);

      cy.get(DIALOG).find('input[type="search"]').type('Hait');
      cy.get(DIALOG).contains(/Hait[ií]/).click();
      cy.get(DIALOG).contains('HTG').click();
      destinationButton().should('contain.text', 'HTG');
    });
  });

  describe('3. Conversion', () => {
    beforeEach(() => {
      selectHaitiHTG();
    });

    it('converts 25000 CLP to HTG using the displayed rate', () => {
      setSendAmount('25000');

      // The rate is live ("1 CLP = x HTG"), so the expected value is derived from the rate on screen,
      // never hard-coded. The promo banner may lag behind the currency change: wait until it shows HTG.
      cy.get('body').should(($b) => {
        expect(rateText($b[0]), 'rate banner shows HTG').to.match(/HTG/);
      });
      cy.get('body').then(($b) => {
        const banner = rateText($b[0]);
        const m = [...banner.matchAll(/(\d+[.,]\d+)\s*HTG/g)].pop();
        expect(m, `rate not found in banner text: "${banner}"`).to.not.equal(undefined);
        const rate = Number(m[1].replace(',', '.'));
        expect(rate, 'displayed rate').to.be.greaterThan(0);

        cy.get(RECEIVE).should(($el) => {
          const received = toNumber($el.val());
          // rate is shown rounded to 6 decimals -> allow a few cents
          expect(received).to.be.closeTo(25000 * rate, 0.05);
        });
      });
    });

    it('recalculates the received amount when the send amount changes', () => {
      setSendAmount('25000');
      cy.get(RECEIVE).should('not.have.value', '').invoke('val').then((first) => {
        const base = toNumber(first);
        expect(base).to.be.greaterThan(0);

        setSendAmount('50000');
        cy.get(RECEIVE).should(($el) => {
          const doubled = toNumber($el.val());
          expect(doubled).to.not.equal(base);
          expect(doubled / base).to.be.closeTo(2, 0.02);
        });
      });
    });
  });
});
