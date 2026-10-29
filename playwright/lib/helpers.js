// Playwright helpers for the RIA challenge.
// If the site answers with a bot challenge / 403 / blank page we STOP and report it (BlockedError): never bypassed.
const { expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.riamoneytransfer.com';
const SECURE = 'https://secure.riamoneytransfer.com';
const SHOTS = path.join(__dirname, '..', '..', 'screenshots', 'playwright');

const SEND = '#amount-from';
const RECEIVE = '#amount-to';
const DIALOG = '[role="dialog"]';
const GET_STARTED = 'a[href="https://secure.riamoneytransfer.com/"]';

class BlockedError extends Error {}

const bodyText = (page) => page.locator('body').innerText().catch(() => '');

/** Stop (no retries) when the page is a bot challenge or a 403 page. */
const assertNotBlocked = async (page, what) => {
  const looksBlocked = async () => {
    const title = await page.title().catch(() => '');
    const body = await bodyText(page);
    return /just a moment/i.test(title) || /security verification|403.{0,3}forbidden/i.test(body);
  };
  if (await looksBlocked()) {
    await page.waitForTimeout(8000); // one grace period; a real challenge does not clear for automation
    if (await looksBlocked()) {
      throw new BlockedError(`BLOCKED: ${what} answers automation with a bot challenge / 403 (Cloudflare). Not a test bug; not bypassed.`);
    }
  }
};

const visit = async (page, url) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await assertNotBlocked(page, url);
};

const openCalculator = async (page) => {
  await visit(page, `${BASE}/es-cl/`);
  await page.locator(SEND).waitFor({ state: 'visible', timeout: 30000 });
  await waitForHydration(page);
};

/** The SSR page is visible before React attaches its handlers: input typed / buttons clicked too early are
 *  ignored or reset (observed). React marks hydrated DOM nodes with __reactFiber$/__reactProps$ keys.
 *  Non-fatal: if the marker never shows up we fall back to the load/network-idle events. */
const waitForHydration = async (page) => {
  await page.waitForLoadState('load');
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('#amount-from');
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$'));
    }, null, { timeout: 10000 });
  } catch (e) {
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  }
};

/** App never rendered (blank body): reported as a probable block, not retried. */
const assertRendered = async (page, selector, what, timeout = 40000) => {
  try {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout });
  } catch (e) {
    if (!(await bodyText(page)).trim()) {
      throw new BlockedError(`BLOCKED?: ${what} rendered a blank page for automation (probable bot defense). Not retried, not bypassed.`);
    }
    throw e;
  }
};

/** es-cl formats: "100.000" (thousands) and "3.350,82" / "0,134033" (decimal comma). */
const toNumber = (t) => {
  const s = String(t).trim().replace(/[^\d.,]/g, '');
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
};

const typeAmount = async (page, value) => {
  const send = page.locator(SEND);
  await send.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  if (value) await send.pressSequentially(value);
  return send;
};

/** Destination trigger = the dialog button inside the "receive" card. */
const destinationButton = (page) => page.locator(RECEIVE)
  .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
  .locator('button[aria-haspopup="dialog"]');

/** The destination picker. The page always has two role=dialog nodes (a popover and this dialog), so use
 *  the shadcn data-slot instead of role alone (language neutral: its accessible name is "Selecciona Destino"). */
const pickerDialog = (page) => page.locator('[role="dialog"][data-slot="dialog-content"]');

/** Click until the dialog is really open (an early click can be ignored while the app hydrates). */
const openDestinationDialog = async (page) => {
  const dialog = pickerDialog(page);
  await expect(async () => {
    if (!(await dialog.isVisible())) await destinationButton(page).click({ timeout: 3000 });
    await expect(dialog).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30000 });
  return dialog;
};

/** Destination picker is two-level: country -> currency (Haiti -> HTG | USD). */
const selectHaitiHTG = async (page) => {
  const dialog = await openDestinationDialog(page);
  await dialog.locator('[role="option"]').filter({ hasText: /Hait[ií]/i }).first().click();
  await dialog.locator('[role="option"]').filter({ hasText: /^\s*HTG/ }).first().click();
  await expect(dialog).toBeHidden(); // it stays in the DOM, hidden
  await expect(destinationButton(page)).toContainText('HTG');
};

/** Promo banner, e.g. "1 CLP = 0,131700 0,134033 HTG". Struck-through and promo rates sit in adjacent
 *  elements (textContent glues them), so join the text nodes with spaces. */
const rateText = (page) => page.evaluate(() => {
  const re = /1\s*CLP\s*=[\s\d.,]*\s[A-Z]{3}/;
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
  return parts.join(' ');
});

/** Cookie banner appears late and only on a fresh browser context: close it only if it shows up. */
const rejectCookiesIfShown = async (page) => {
  await page.waitForTimeout(2500);
  const banner = page.locator('.ria-gdpr-consent-manager-dialog');
  if (await banner.count()) {
    await banner.getByRole('button', { name: /rechazar|reject|decline/i }).first().click();
    await expect(banner).toHaveCount(0);
  }
};

const POPOVER = '[role="dialog"][data-slot="popover-content"][data-state="open"]';
const REGISTER_FROM_SITE = 'a[href*="secure.riamoneytransfer.com/registration"]:visible';

/** Uses the site's own header selector: "Select language and region" -> Country -> United States (/en-us/).
 *  Selectors are language neutral (aria-label, role, data-slot and the link href). Idempotent. */
const switchToUnitedStates = async (page) => {
  if (/\/en-us\//.test(page.url())) { await assertNotBlocked(page, 'www /en-us/'); return; }
  const popover = page.locator(POPOVER);
  await expect(async () => { // an early click can be ignored while the app hydrates
    if (!(await popover.isVisible())) await page.locator('button[aria-label="Select language and region"]').click({ timeout: 3000 });
    await expect(popover.locator('[role="menuitem"]').first()).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30000 });
  await popover.locator('[role="menuitem"]').filter({ hasText: /Pa[ií]s|Country/i }).click();
  const us = popover.locator('a[href="/en-us/"]');
  await us.scrollIntoViewIfNeeded();
  await us.click();
  await page.waitForURL(/\/en-us\//, { timeout: 30000 });
  await assertNotBlocked(page, 'www /en-us/');
};

/** Clicks the site's Register link and returns the text of the page it lands on. */
const registerFromSite = async (page) => {
  const link = page.locator(REGISTER_FROM_SITE).first();
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await page.waitForURL(/secure\.riamoneytransfer\.com\/registration/, { timeout: 30000 });
  await page.waitForTimeout(4000);
  return bodyText(page);
};

/** Evidence screenshot. A small label with the current URL (no query string) is drawn ONLY while capturing and removed
 *  right after, because a page screenshot does not include the browser address bar. */
const shot = async (page, name, status) => {
  try {
    fs.mkdirSync(SHOTS, { recursive: true });
    const safe = `${status || 'run'}__${name}`.replace(/[^\w.-]+/g, '_').slice(0, 150);
    const url = page.url().split('?')[0];
    await page.evaluate((u) => {
      const d = document.createElement('div');
      d.id = '__evidence_url';
      d.textContent = 'URL: ' + u;
      d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:4px 8px;font:12px/1.2 monospace;background:#111;color:#fff;border-radius:4px;pointer-events:none;opacity:.92';
      document.documentElement.appendChild(d);
    }, url);
    await page.screenshot({ path: path.join(SHOTS, `${safe}.png`) });
    await page.evaluate(() => { const d = document.getElementById('__evidence_url'); if (d) d.remove(); });
  } catch (e) { /* best effort */ }
};

const pause = async (page) => {
  const ms = Number(process.env.PAUSE) || 0;
  if (ms > 0) await page.waitForTimeout(ms);
};

module.exports = {
  BASE, SECURE, SEND, RECEIVE, DIALOG, GET_STARTED, BlockedError,
  visit, openCalculator, assertRendered, toNumber, typeAmount, destinationButton, pickerDialog, openDestinationDialog, selectHaitiHTG,
  rateText, rejectCookiesIfShown, shot, pause, bodyText, switchToUnitedStates, registerFromSite, REGISTER_FROM_SITE,
};
