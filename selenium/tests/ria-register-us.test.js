const assert = require('node:assert');
const h = require('../lib/helpers');

// EXTRA scenario: the challenge asks that Register leads to the country selection page. From Chile the secure site
// answers "you cannot register an account in Chile" (see ria-secure.test.js), so here the site's own country
// selector is switched to United States first and the check is repeated.
// Verified by hand on 2026-10-29: the selector works (-> /en-us/) but registration stays blocked, because the check is
// based on the REAL location ("Según tu ubicación actual..."), not on the selector. From a location where Ria allows
// registration the second test is expected to pass. NOTE: /en-us/ is answered with the Cloudflare challenge when
// automated (observed 2026-10-29), so both tests stop with a BLOCKED message; this is reported, never bypassed.
describe('Register after switching the site country to United States [Selenium]', function () {
  this.timeout(120000);
  let driver;

  before(async () => {
    driver = await h.buildDriver();
    try { await h.openCalculator(driver); }
    catch (e) { await h.shot(driver, 'register-us-open', 'FAILED'); throw e; }
  });
  after(async () => { if (driver) await driver.quit(); });
  afterEach(async function () {
    await h.shot(driver, this.currentTest.title, this.currentTest.state);
    await h.pause(driver);
  });

  it('site country selector switches Chile -> United States (/en-us/)', async () => {
    await h.switchToUnitedStates(driver);
    assert.match(await driver.getCurrentUrl(), /\/en-us\//);
    assert.ok(await h.firstDisplayed(driver, h.REGISTER_FROM_SITE), 'Register link is shown on the US site');
  });

  it('Register after switching to United States shows the country selection page', async () => {
    await h.switchToUnitedStates(driver); // no-op when the previous test already did it
    const body = await h.registerFromSite(driver);
    if (/cannot register an account|no puedes registrar una cuenta/i.test(body)) {
      assert.fail('GEO-BLOCKED: registration is still unavailable after switching the site country to United States. '
        + 'The check uses the real location (Chile), not the selector. Not a test bug.');
    }
    assert.match(body, /select (your )?country|country of residence|elige (tu )?pa[ií]s|selecciona (tu )?pa[ií]s/i);
  });
});
