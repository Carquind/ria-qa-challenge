const { test, expect } = require('@playwright/test');
const h = require('../lib/helpers');

// EXTRA scenario: the challenge asks that Register leads to the country selection page. From Chile the secure site
// answers "you cannot register an account in Chile" (see ria-secure.spec.js), so here the site's own country
// selector is switched to United States first and the check is repeated.
// Verified by hand on 2026-10-29: the selector works (-> /en-us/) but registration stays blocked, because the check is
// based on the REAL location ("Según tu ubicación actual..."), not on the selector. From a location where Ria allows
// registration the second test is expected to pass. NOTE: /en-us/ is answered with the Cloudflare challenge when
// automated (observed 2026-10-29), so both tests stop with a BLOCKED message; this is reported, never bypassed.
test.describe('Register after switching the site country to United States [Playwright]', () => {
  test.beforeEach(async ({ page }) => {
    await h.openCalculator(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await h.shot(page, testInfo.title, testInfo.status);
    await h.pause(page);
  });

  test('site country selector switches Chile -> United States (/en-us/)', async ({ page }) => {
    await h.switchToUnitedStates(page);
    await expect(page).toHaveURL(/\/en-us\//);
    await expect(page.locator(h.REGISTER_FROM_SITE).first(), 'Register link is shown on the US site').toBeVisible();
  });

  test('Register after switching to United States shows the country selection page', async ({ page }) => {
    await h.switchToUnitedStates(page);
    const body = await h.registerFromSite(page);
    if (/cannot register an account|no puedes registrar una cuenta/i.test(body)) {
      throw new Error('GEO-BLOCKED: registration is still unavailable after switching the site country to United States. '
        + 'The check uses the real location (Chile), not the selector. Not a test bug.');
    }
    expect(body).toMatch(/select (your )?country|country of residence|elige (tu )?pa[ií]s|selecciona (tu )?pa[ií]s/i);
  });
});
