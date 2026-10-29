const { test, expect } = require('@playwright/test');
const h = require('../lib/helpers');

// Every test gets a fresh page, so no state is shared and each screenshot shows what that test did
// (Playwright also restarts its worker after a failure, so shared state would not survive the expected failures).
test.describe('Ria calculator (es-cl) - CLP -> Haiti HTG [Playwright]', () => {
  test.beforeEach(async ({ page }) => {
    await h.openCalculator(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await h.shot(page, testInfo.title, testInfo.status);
    await h.pause(page);
  });

  /** Types `amount`, derives the rate from the banner ("1 CLP = x HTG") and checks received = amount x rate. */
  const expectConversion = async (page, amount) => {
    await h.typeAmount(page, String(amount));
    // The promo banner may lag behind the currency change: poll until it shows HTG.
    await expect.poll(async () => (await h.rateText(page)) || '', { message: 'rate banner never switched to HTG' })
      .toMatch(/HTG/);
    const banner = (await h.rateText(page)) || '';
    const m = [...banner.matchAll(/(\d+[.,]\d+)\s*HTG/g)].pop();
    expect(m, `rate not found in banner text: "${banner}"`).toBeTruthy();
    const rate = Number(m[1].replace(',', '.'));
    const received = async () => h.toNumber(await page.locator(h.RECEIVE).inputValue());
    await expect.poll(received, { message: `expected ~${(amount * rate).toFixed(2)} HTG for ${amount} CLP` })
      .toBeCloseTo(amount * rate, 1); // |diff| < 0.05 (the rate is shown with 6 decimals)
    return received();
  };

  test('does not accept alphabet characters in the amount field', async ({ page }) => {
    const send = await h.typeAmount(page, 'abc');
    await expect(send).toHaveValue('');
  });

  // Acceptance criterion. Observed manually on 2026-10-28: letters are silently dropped and no message is
  // rendered (only an sr-only hint with the allowed range) -> expected to FAIL (product finding).
  test('shows "Please enter a valid amount" when letters are entered', async ({ page }) => {
    const send = await h.typeAmount(page, 'abc');
    await send.press('Tab');
    await expect(page.locator('body'), 'No "valid amount" message is shown after typing letters')
      .toContainText(/Please enter a valid amount|monto v[aá]lido|importe v[aá]lido/i, { timeout: 5000 });
  });

  test('"Send to" dropdown lets the user select a country (Haiti / HTG)', async ({ page }) => {
    const dialog = await h.openDestinationDialog(page);
    await expect(dialog.locator('input[type="search"]')).toBeVisible();
    expect(await dialog.locator('[role="option"]').count()).toBeGreaterThan(1);
    await page.waitForTimeout(800); // let the dialog's open animation finish, so the list is not captured half-transparent
    await h.shot(page, 'send-to-dropdown-open', 'step'); // evidence: the open list of destination countries
    await dialog.locator('[role="option"]').filter({ hasText: /Hait[ií]/i }).first().click(); // country
    await dialog.locator('[role="option"]').filter({ hasText: /^\s*HTG/ }).first().click();   // currency
    await expect(dialog).toBeHidden();
    await expect(h.destinationButton(page)).toContainText('HTG');
  });

  test('converts 25000 CLP to HTG using the displayed rate', async ({ page }) => {
    await h.selectHaitiHTG(page);
    await expectConversion(page, 25000); // the screenshot of this test ends with 25000 CLP on screen
  });

  test('recalculates the received amount when the send amount changes (25000 -> 50000)', async ({ page }) => {
    await h.selectHaitiHTG(page);
    const base = await expectConversion(page, 25000);
    const doubled = await expectConversion(page, 50000);
    expect(doubled / base, `50000 CLP should be ~2x of 25000 (${base})`).toBeCloseTo(2, 1);
  });

  test('"Get Started" on the calculator lands on secure.riamoneytransfer.com', async ({ page }) => {
    const link = page.locator(h.GET_STARTED).first();
    await expect(link).toHaveAttribute('href', 'https://secure.riamoneytransfer.com/');
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await page.waitForURL(/secure\.riamoneytransfer\.com/, { timeout: 30000 });
    await h.assertRendered(page, 'input[type="password"]', h.SECURE); // wait for the page, so the screenshot is not blank
    await h.rejectCookiesIfShown(page); // close the cookie banner so the screenshot shows the page, not the grey overlay
  });
});
