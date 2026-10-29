const assert = require('node:assert');
const h = require('../lib/helpers');

describe('Ria calculator (es-cl) - CLP -> Haiti HTG [Selenium]', function () {
  this.timeout(120000);
  let driver;

  // A FRESH browser session per test (like Playwright's fresh context). Observed on 2026-10-29: reloading the page
  // inside the same automated session made Cloudflare challenge the second load, while fresh sessions were not.
  // It also keeps tests independent: each screenshot shows what that test did, not what the previous one left behind.
  beforeEach(async () => {
    driver = await h.buildDriver();
    try { await h.openCalculator(driver); }
    catch (e) {
      await h.shot(driver, 'calculator-open', 'FAILED');
      await driver.quit();
      driver = null;
      throw e;
    }
  });
  afterEach(async function () {
    if (!driver) return;
    if (this.currentTest) await h.shot(driver, this.currentTest.title, this.currentTest.state);
    await h.pause(driver);
    await driver.quit();
    driver = null;
  });
  after(async () => { if (driver) await driver.quit(); });

  /** Types `amount`, derives the rate from the banner ("1 CLP = x HTG") and checks received = amount x rate. */
  const expectConversion = async (amount) => {
    await h.typeAmount(driver, String(amount));
    let banner = '';
    await driver.wait(async () => { banner = (await h.rateText(driver)) || ''; return /HTG/.test(banner); }, 15000)
      .catch(() => assert.fail(`rate banner never switched to HTG; last text: "${banner}"`));
    const m = [...banner.matchAll(/(\d+[.,]\d+)\s*HTG/g)].pop();
    assert.ok(m, `rate not found in banner text: "${banner}"`);
    const rate = Number(m[1].replace(',', '.'));
    const received = async () => h.toNumber(await driver.findElement(h.css(h.RECEIVE)).getAttribute('value'));
    await driver.wait(async () => Math.abs((await received()) - amount * rate) < 0.05, 15000) // rate is shown with 6 decimals
      .catch(async () => assert.fail(`expected ~${(amount * rate).toFixed(2)} HTG for ${amount} CLP, got ${await received()}`));
    return received();
  };

  it('does not accept alphabet characters in the amount field', async () => {
    const el = await h.typeAmount(driver, 'abc');
    assert.strictEqual(await el.getAttribute('value'), '');
  });

  // Acceptance criterion. Observed manually on 2026-10-28: letters are silently dropped and no message is
  // rendered (only an sr-only hint with the allowed range) -> expected to FAIL (product finding).
  it('shows "Please enter a valid amount" when letters are entered', async () => {
    const el = await h.typeAmount(driver, 'abc');
    await el.sendKeys(h.Key.TAB);
    assert.match(await h.text(driver), /Please enter a valid amount|monto v[aá]lido|importe v[aá]lido/i,
      'No "valid amount" message is shown after typing letters');
  });

  it('"Send to" dropdown lets the user select a country (Haiti / HTG)', async () => {
    await (await h.destinationButton(driver)).click();
    await driver.wait(h.until.elementLocated(h.css(`${h.DIALOG} input[type="search"]`)), 15000);
    const options = await driver.findElements(h.css(`${h.DIALOG} [role="option"]`));
    assert.ok(options.length > 1, 'dialog should list several destinations');
    await driver.sleep(800); // let the dialog's open animation finish, so the list is not captured half-transparent
    await h.shot(driver, 'send-to-dropdown-open', 'step'); // evidence: the open list of destination countries
    // pick the country, then its currency (two-level list), in the same dialog
    await h.clickOptionIn(driver, /Hait[ií]/i);
    await h.clickOptionIn(driver, /^HTG/i);
    await h.waitDialogClosed(driver);
    assert.match(await (await h.destinationButton(driver)).getText(), /HTG/);
  });

  it('converts 25000 CLP to HTG using the displayed rate', async () => {
    await h.selectHaitiHTG(driver);
    await expectConversion(25000); // the screenshot of this test ends with 25000 CLP on screen
  });

  it('recalculates the received amount when the send amount changes (25000 -> 50000)', async () => {
    await h.selectHaitiHTG(driver);
    const base = await expectConversion(25000);
    const doubled = await expectConversion(50000);
    assert.ok(Math.abs(doubled / base - 2) < 0.02, `50000 CLP should be ~2x of 25000 (${base}), got ${doubled}`);
  });

  it('"Get Started" on the calculator lands on secure.riamoneytransfer.com', async () => {
    const link = await driver.findElement(h.css(h.GET_STARTED));
    assert.strictEqual(await link.getAttribute('href'), 'https://secure.riamoneytransfer.com/');
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', link);
    await link.click();
    await driver.wait(h.until.urlContains('secure.riamoneytransfer.com'), 30000);
    await h.assertRendered(driver, 'input[type="password"]', h.SECURE); // wait for the page, so the screenshot is not blank
    await h.rejectCookiesIfShown(driver); // close the cookie banner so the screenshot shows the page, not the grey overlay
  });
});
