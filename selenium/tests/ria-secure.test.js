const assert = require('node:assert');
const h = require('../lib/helpers');

describe('secure.riamoneytransfer.com [Selenium]', function () {
  this.timeout(120000);
  let driver;

  before(async () => {
    driver = await h.buildDriver();
    try {
      await h.visit(driver, `${h.SECURE}/`); // redirects to /login
      await h.assertRendered(driver, 'input[type="password"]', h.SECURE); // slow SPA on cold cache: waits up to 40s
      await h.rejectCookiesIfShown(driver);
    } catch (e) { await h.shot(driver, 'secure-open', 'FAILED'); throw e; }
  });
  after(async () => { if (driver) await driver.quit(); });
  afterEach(async function () {
    await h.shot(driver, this.currentTest.title, this.currentTest.state);
    await h.pause(driver);
  });

  it('shows Register, phone/email and password', async () => {
    assert.ok((await driver.findElements(h.css('input[autocomplete="username"]'))).length, 'phone/email field');
    assert.ok((await driver.findElements(h.css('input[type="password"]'))).length, 'password field');
    assert.ok((await driver.findElements(h.css('a[href="/registration"]'))).length, 'Register link');
  });

  it('Register navigates to /registration and shows the country selection page', async () => {
    await driver.findElement(h.css('a[href="/registration"]')).click();
    await driver.wait(h.until.urlContains('/registration'), 20000);
    await driver.sleep(3000);
    const body = await h.text(driver);
    // Observed from Chile: product geo-restriction modal instead of the country page.
    if (/cannot register an account|no puedes registrar una cuenta/i.test(body)) {
      assert.fail('GEO-BLOCKED: registration is not available from this location (Chile). Not a test bug.');
    }
    assert.match(body, /select (your )?country|country of residence|elige (tu )?pa[ií]s|selecciona (tu )?pa[ií]s/i);
  });
});
