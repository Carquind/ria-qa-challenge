const { test, expect } = require('@playwright/test');
const h = require('../lib/helpers');

const REGISTER_LINK = 'a[href="/registration"]'; // "Register" is a link, not a button

test.describe('secure.riamoneytransfer.com [Playwright]', () => {
  test.beforeEach(async ({ page }) => {
    await h.visit(page, `${h.SECURE}/`); // redirects to /login
    await h.assertRendered(page, 'input[type="password"]', h.SECURE); // SPA is slow on a cold cache: up to 40 s
    await h.rejectCookiesIfShown(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await h.shot(page, testInfo.title, testInfo.status);
    await h.pause(page);
  });

  test('shows Register, phone/email and password', async ({ page }) => {
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible(); // phone or email
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator(REGISTER_LINK)).toBeVisible();
  });

  test('Register navigates to /registration and shows the country selection page', async ({ page }) => {
    await page.locator(REGISTER_LINK).click();
    await page.waitForURL(/\/registration/, { timeout: 20000 });
    await page.waitForTimeout(3000);
    const body = await h.bodyText(page);
    // Observed from Chile: product geo-restriction modal instead of the country page.
    if (/cannot register an account|no puedes registrar una cuenta/i.test(body)) {
      throw new Error('GEO-BLOCKED: registration is not available from this location (Chile). Not a test bug.');
    }
    expect(body).toMatch(/select (your )?country|country of residence|elige (tu )?pa[ií]s|selecciona (tu )?pa[ií]s/i);
  });
});
