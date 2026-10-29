// Selenium (JavaScript) helpers for the RIA challenge.
// Chrome is started with DEFAULT options on purpose: no stealth flags, no header spoofing.
// If the site answers with a bot challenge / 403 we stop and report it (BlockedError).
const { Builder, By, Key, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.riamoneytransfer.com';
const SECURE = 'https://secure.riamoneytransfer.com';
const SHOTS = path.join(__dirname, '..', '..', 'screenshots', 'selenium');

const SEND = '#amount-from';
const RECEIVE = '#amount-to';
const DIALOG = '[role="dialog"]';
const GET_STARTED = 'a[href="https://secure.riamoneytransfer.com/"]';
const MOD = process.platform === 'darwin' ? Key.COMMAND : Key.CONTROL;

class BlockedError extends Error {}

const buildDriver = async () => {
  const driver = await new Builder().forBrowser('chrome').build();
  await driver.manage().window().setRect({ width: 1366, height: 900 });
  return driver;
};

const css = (sel) => By.css(sel);

/** Stop (no retries) when the page is a bot challenge or a 403 page. */
const assertNotBlocked = async (driver, what) => {
  const looksBlocked = async () => {
    const title = await driver.getTitle();
    const body = await driver.findElement(css('body')).getText().catch(() => '');
    return /just a moment/i.test(title) || /security verification|403.{0,3}forbidden/i.test(body);
  };
  if (await looksBlocked()) {
    await driver.sleep(8000); // a single grace period; a real challenge does not clear for automation
    if (await looksBlocked()) {
      throw new BlockedError(`BLOCKED: ${what} answers automation with a bot challenge / 403 (Cloudflare). Not a test bug; not bypassed.`);
    }
  }
};

const visit = async (driver, url) => {
  await driver.get(url);
  await assertNotBlocked(driver, url);
};

/** App never rendered: blank body after waiting. Reported as a probable block, not retried. */
const assertRendered = async (driver, selector, what, timeout = 40000) => {
  try {
    await driver.wait(until.elementLocated(css(selector)), timeout);
  } catch (e) {
    const body = (await text(driver).catch(() => '')).trim();
    if (!body) {
      throw new BlockedError(`BLOCKED?: ${what} rendered a blank page for automation (probable bot defense). Not retried, not bypassed.`);
    }
    throw e;
  }
};

const openCalculator = async (driver) => {
  await visit(driver, `${BASE}/es-cl/`);
  await driver.wait(until.elementLocated(css(SEND)), 30000);
  await waitForHydration(driver);
};

function text(driver) { return driver.findElement(css('body')).getText(); }


const typeAmount = async (driver, value) => {
  const el = await driver.findElement(css(SEND));
  await el.click();
  await el.sendKeys(Key.chord(MOD, 'a'), Key.BACK_SPACE);
  if (value) await el.sendKeys(value);
  return el;
};

/** es-cl formats: "100.000" (thousands) and "3.350,82" / "0,134033" (decimal comma). */
const toNumber = (t) => {
  const s = String(t).trim().replace(/[^\d.,]/g, '');
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
};

/** Closed = not displayed OR removed from the DOM. After closing, the page sometimes unmounts the dialog between
 *  findElements and isDisplayed, which throws StaleElementReferenceError: a vanished element means it is closed. */
const waitDialogClosed = (driver) => driver.wait(async () => {
  const dialogs = await driver.findElements(css(DIALOG));
  for (const d of dialogs) {
    try {
      if (await d.isDisplayed()) return false;
    } catch (e) {
      if (e.name !== 'StaleElementReferenceError') throw e;
    }
  }
  return true;
}, 15000);

/** Promo banner text, e.g. "1 CLP = 0,131700 0,134033 HTG". Struck-through and promo rates sit in
 *  adjacent elements, so textContent glues them, e.g. "3,1473,2491 COP": join the text nodes with spaces. */
const rateText = (driver) => driver.executeScript(`
  const re = /1\\s*CLP\\s*=[\\s\\d.,]*\\s[A-Z]{3}/;
  let best = null;
  for (const el of document.querySelectorAll('body *')) {
    const t = (el.textContent || '').trim();
    if (re.test(t) && (best === null || t.length < (best.textContent || '').trim().length)) best = el;
  }
  if (!best) return null;
  const walker = document.createTreeWalker(best, NodeFilter.SHOW_TEXT);
  const parts = [];
  let n;
  while ((n = walker.nextNode())) { const v = n.textContent.trim(); if (v) parts.push(v); }
  return parts.join(' ');`);

const destinationButton = (driver) => driver.findElement(By.xpath(
  "//input[@id='amount-to']/ancestor::div[contains(@class,'rounded-xl')][1]//button[@aria-haspopup='dialog']"));

/** Click the first element matching `selector` whose text matches `regex`. Lists are re-rendered by the page
 *  (e.g. countries -> currencies), so elements found a moment earlier can go stale: look them up again and retry. */
const clickMatching = async (driver, selector, regex) => {
  const deadline = Date.now() + 15000;
  let sawStale = false;
  while (Date.now() < deadline) {
    try {
      const elements = await driver.findElements(css(selector));
      for (const el of elements) {
        if (regex.test(await el.getText())) { await el.click(); return; }
      }
    } catch (e) {
      if (e.name !== 'StaleElementReferenceError') throw e;
      sawStale = true;
    }
    await driver.sleep(300);
  }
  throw new Error(`No element "${selector}" matching ${regex}${sawStale ? ' (the list kept re-rendering)' : ''}`);
};

const clickOptionIn = (driver, regex) => clickMatching(driver, `${DIALOG} [role="option"]`, regex);

/** Destination picker is two-level: country -> currency (Haiti -> HTG | USD). */
const selectHaitiHTG = async (driver) => {
  await (await destinationButton(driver)).click();
  await clickOptionIn(driver, /Hait[ií]/i);
  await clickOptionIn(driver, /^HTG/i);
  await waitDialogClosed(driver);
  await driver.wait(async () => /HTG/.test(await (await destinationButton(driver)).getText()), 15000);
};

/** Evidence screenshot. A small label with the current URL (no query string) is drawn ONLY while capturing and removed
 *  right after, because a WebDriver screenshot does not include the browser address bar. */
const shot = async (driver, name, state) => {
  try {
    fs.mkdirSync(SHOTS, { recursive: true });
    const safe = `${state || 'run'}__${name}`.replace(/[^\w.-]+/g, '_').slice(0, 150);
    const url = (await driver.getCurrentUrl()).split('?')[0];
    await driver.executeScript(`
      const d = document.createElement('div');
      d.id = '__evidence_url';
      d.textContent = 'URL: ' + arguments[0];
      d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:4px 8px;font:12px/1.2 monospace;background:#111;color:#fff;border-radius:4px;pointer-events:none;opacity:.92';
      document.documentElement.appendChild(d);`, url);
    const png = await driver.takeScreenshot();
    await driver.executeScript(`const d = document.getElementById('__evidence_url'); if (d) d.remove();`);
    fs.writeFileSync(path.join(SHOTS, `${safe}.png`), png, 'base64');
  } catch (e) { /* screenshots are best effort */ }
};

const pause = (driver) => driver.sleep(Number(process.env.PAUSE) || 0);

/** Cookie banner appears late and only on the first visit: close it only if it shows up. */
const rejectCookiesIfShown = async (driver) => {
  await driver.sleep(2500);
  const banners = await driver.findElements(css('.ria-gdpr-consent-manager-dialog'));
  if (banners.length) {
    const buttons = await banners[0].findElements(By.css('button'));
    for (const b of buttons) {
      if (/rechazar|reject|decline/i.test(await b.getText())) { await b.click(); break; }
    }
    await driver.wait(async () => (await driver.findElements(css('.ria-gdpr-consent-manager-dialog'))).length === 0, 10000);
  }
};

/** The SSR page is visible before React attaches its handlers: early clicks are ignored (observed).
 *  React marks hydrated nodes with __reactFiber$/__reactProps$ keys. Non-fatal if it never shows up. */
const waitForHydration = async (driver) => {
  try {
    await driver.wait(() => driver.executeScript(`
      const el = document.querySelector('#amount-from');
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$'));`), 10000);
  } catch (e) { /* fall through: the page may simply be slower */ }
};

/** First element matching the selector that is displayed (the page also holds hidden duplicates, e.g. mobile menus). */
const firstDisplayed = async (driver, selector, timeout = 15000) => {
  let found = null;
  await driver.wait(async () => {
    const els = await driver.findElements(css(selector));
    for (const el of els) {
      try { if (await el.isDisplayed()) { found = el; return true; } }
      catch (e) { if (e.name !== 'StaleElementReferenceError') throw e; }
    }
    return false;
  }, timeout, `no displayed element for ${selector}`);
  return found;
};

const POPOVER = '[role="dialog"][data-slot="popover-content"][data-state="open"]';

/** Uses the site's own header selector: "Select language and region" -> Country -> United States (/en-us/).
 *  Selectors are language neutral (aria-label, role, data-slot and the link href). Idempotent. */
const switchToUnitedStates = async (driver) => {
  if (/\/en-us\//.test(await driver.getCurrentUrl())) { await assertNotBlocked(driver, 'www /en-us/'); return; }
  const trigger = await firstDisplayed(driver, 'button[aria-label="Select language and region"]');
  await trigger.click();
  await driver.wait(async () => (await driver.findElements(css(`${POPOVER} [role="menuitem"]`))).length > 0, 15000);
  await clickMatching(driver, `${POPOVER} [role="menuitem"]`, /Pa[ií]s|Country/i);
  const us = await firstDisplayed(driver, `${POPOVER} a[href="/en-us/"]`);
  await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', us);
  await us.click();
  await driver.wait(until.urlContains('/en-us/'), 30000);
  await assertNotBlocked(driver, 'www /en-us/');
};

const REGISTER_FROM_SITE = 'a[href*="secure.riamoneytransfer.com/registration"]';

/** Clicks the site's Register link and returns the text of the page it lands on. */
const registerFromSite = async (driver) => {
  const link = await firstDisplayed(driver, REGISTER_FROM_SITE);
  await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', link);
  await link.click();
  await driver.wait(until.urlContains('secure.riamoneytransfer.com/registration'), 30000);
  await driver.sleep(4000);
  return text(driver);
};

module.exports = {
  By, Key, until, BASE, SECURE, SEND, RECEIVE, DIALOG, GET_STARTED, BlockedError,
  buildDriver, css, visit, assertRendered, openCalculator, text, typeAmount, toNumber,
  destinationButton, waitDialogClosed, rateText, clickMatching, clickOptionIn, waitForHydration, firstDisplayed, switchToUnitedStates, registerFromSite, REGISTER_FROM_SITE, selectHaitiHTG, shot, pause, rejectCookiesIfShown, assertNotBlocked,
};
