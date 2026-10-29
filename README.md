# RIA QA Challenge

End-to-end tests for the **Ria calculator** and the **secure sign-in/register page** of riamoneytransfer.com, plus **API tests**
with Postman/newman. The same UI scenarios are implemented three times (Selenium, Playwright, Cypress), all in JavaScript.

> **TL;DR** – API tests: **8/8 pass**. UI: Selenium and Playwright each run **10 tests: 6 pass, 4 fail**. Two failures are
> product/location findings (F1, F6) and two are the extra "switch country to United States" scenario, which Cloudflare blocks for automation on `/en-us/` (F5). Cypress is blocked by Cloudflare on `www.riamoneytransfer.com` (documented, **not bypassed**).
> Acceptance criterion verified: **25000 CLP -> HTG = 25000 x the displayed rate** (3.298,82 HTG at 0,131953 on 2026-10-29).

## 1. Results at a glance

| Suite | Tool | Tests | Passed | Failed | Exit code | Why it fails |
|---|---|---:|---:|---:|---:|---|
| **API** | Postman / newman | 8 assertions | **8** | 0 | 0 | – |
| **UI (main)** | Selenium + Mocha | 10 | **6** | 4 | 4 | F1, F6, and F5 on `/en-us/` (2 extra tests) |
| **UI** | Playwright | 10 | **6** | 4 | 1* | F1, F6, and F5 on `/en-us/` (2 extra tests) |
| **UI (alternative)** | Cypress | 9 | 2 | 3 (+4 skipped) | 3 | F6, and Cloudflare 403 on `www` (F5) |

\* Playwright returns exit code 1 for any failure; Mocha and Cypress return the number of failing tests.

The four UI failures common to Selenium and Playwright are **kept failing on purpose** (none is skipped or hidden): the tests were not weakened to get a green run.

## 2. What was asked and where it is covered

| # | Requirement of the brief | Selenium / Playwright test | Result | What the screenshot shows |
|---|---|---|---|---|
| 1 | "Amount" shows *"Please enter a valid amount"* for letters | `does not accept alphabet characters in the amount field` and `shows "Please enter a valid amount" when letters are entered` | letters rejected PASS / message **FAIL** (F1) | the "You send" field empty after typing `abc`, and no message anywhere |
| 2 | "Send to" dropdown allows selecting a country | `"Send to" dropdown lets the user select a country (Haiti / HTG)` | PASS | `step__send-to-dropdown-open`: the list of destination countries; final shot: HTG selected |
| 3 | Send 25000 CLP to Haiti HTG and validate the converted amount | `converts 25000 CLP to HTG using the displayed rate` | PASS | **25000** in "You send" and the converted HTG amount (e.g. 3.298,82 HTG at the promo rate 0,131953 in the 2026-10-29 screenshots; 3.350,82 HTG at 0,134033 the day before: the rate is live) |
| 3b | Conversion happens when the send amount is updated | `recalculates the received amount when the send amount changes (25000 -> 50000)` | PASS | **50000** on screen and about double the HTG amount (this test is the only one that ends at 50000) |
| 4 | *Get Started* lands on `secure.riamoneytransfer.com` | `"Get Started" on the calculator lands on secure.riamoneytransfer.com` | PASS | the secure login page, with the URL label |
| 5 | Register, phone/email and password are present | `shows Register, phone/email and password` | PASS | the login form with the Register link, "Phone or email" and "Password" |
| 6 | *Register* leads to the country selection page | `Register navigates to /registration and shows the country selection page` | **FAIL** – geo-blocked (F6) | the modal "Unable to register account ... for Chile" |
| 6b | **Extra:** same check after switching the site's own country selector to United States | `site country selector switches Chile -> United States (/en-us/)` and `Register after switching to United States shows the country selection page` | **BLOCKED** for automation by Cloudflare on `/en-us/` (F5). Verified by hand: the selector works, registration stays blocked (F6) – `evidence/manual-checks/` | the Cloudflare challenge page |
| 7 | Postman GET `/posts`: 200, `title`/`body` not empty, no "zombie" | collection request **GET /posts** | PASS | `screenshots/postman/newman-report.png` and `screenshots/results/postman-results.png` |
| 8 | Postman POST `httpbin /post`: 200/201, toppings = bacon, cheese, mushroom, no chicken | collection request **POST /post** | PASS | same |

**Screenshots of the results (as the brief asks):** `screenshots/results/selenium-results.png`, `playwright-results.png`, `cypress-results.png` and
`postman-results.png` (rendered from the run logs), plus the newman report in `screenshots/postman/newman-report.png`.
Every per-test screenshot in `screenshots/{selenium,playwright}/` has a small black **URL** label in the bottom-left corner, drawn only while capturing
(a WebDriver screenshot does not include the browser address bar). Each test starts from a freshly loaded page, so each screenshot shows what that test did.

## 3. Requirements and setup

* Node.js >= 18 (developed with Node 26; **Node 22 LTS recommended** – Cypress 13 does not list Node 26 as supported).
* Google Chrome installed (Selenium and Playwright drive the installed Chrome; chromedriver is fetched by Selenium Manager, no `playwright install` needed).
* No credentials or `.env` are needed. Nothing is logged in and no data is submitted to the site.

```bash
npm install
npx cypress install      # only if Cypress reports its binary is missing (npm may block its postinstall script)
```

## 4. How to run

| Command | What it does |
|---|---|
| `npm run api:test` | newman runs the Postman collection against the real endpoints (HTML report in `postman/newman-report.html`, git-ignored) |
| `npm run sel:test` / `npm run sel:watch` | Selenium suite; `watch` = visible Chrome + 8 s pause after each test |
| `npm run pw:test` / `npm run pw:watch` | Playwright suite (installed Chrome, visible); `watch` adds the pause |
| `npm run pw:report` | opens the last Playwright HTML report |
| `npm run cy:run` / `npm run cy:watch` / `npm run cy:open` | Cypress (see limitation F5); `cy:open` = interactive runner |
| `npm run cy:diag` | Cypress connectivity diagnostic that records how the site answers automation (writes to git-ignored `diagnostics/`) |
| `npm run api:build` | regenerates the Postman collection JSON from `postman/build-collection.js` |
| **`npm run evidence`** | **runs everything** (Postman -> Selenium -> Playwright -> Cypress), stores logs and one screenshot per test, prints exit codes |

Useful variants:

```bash
PAUSE=15000 npm run evidence                                   # longer pause between tests
npx mocha selenium/tests/ria-secure.test.js --timeout 120000   # one Selenium file
npx playwright test playwright/tests/ria-calculator.spec.js    # one Playwright file
npx cypress run --browser chrome --headed --spec "cypress/e2e/ria-secure-registration.cy.js"
```

The Postman collection can also be imported directly into Postman (`postman/ria-api-tests.postman_collection.json`).
Base URLs are collection variables (`postsBaseUrl`, `httpbinBaseUrl`).

## 5. Project layout

```
selenium/tests/ria-calculator.test.js        Selenium: calculator scenarios (6 tests)
selenium/tests/ria-secure.test.js            Selenium: secure site scenarios (2 tests)
selenium/tests/ria-register-us.test.js       Selenium EXTRA: switch the site country to United States, then Register (2 tests)
selenium/lib/helpers.js                      Selenium selectors/helpers (Chrome with DEFAULT options)
playwright/tests/ria-calculator.spec.js      Playwright: calculator scenarios (6 tests)
playwright/tests/ria-secure.spec.js          Playwright: secure site scenarios (2 tests)
playwright/tests/ria-register-us.spec.js     Playwright EXTRA: switch the site country to United States, then Register (2 tests)
playwright/lib/helpers.js, playwright.config.js
cypress/e2e/ria-calculator.cy.js             Cypress: calculator scenarios (5 tests)
cypress/e2e/ria-secure-registration.cy.js    Cypress: secure site + Get Started (4 tests)
cypress/support/{commands,e2e}.js            Cypress helpers; e2e.js takes a screenshot after every test
cypress/diagnostics/step1-connect.cy.js      records the Cloudflare answers (see F5)
postman/ria-api-tests.postman_collection.json  API tests (generated by postman/build-collection.js)
scripts/run-all.sh, scripts/screenshot-report.js  evidence runner; screenshot of the newman HTML report
screenshots/{selenium,playwright,cypress,postman}/  one PNG per test (passed__* / failed__* / step__*)
screenshots/manual-inspection/               manual look at the real site used to write selectors (NOT test results)
evidence/latest/                             logs, JSON results, SUMMARY.txt of the last `npm run evidence`
evidence/cloudflare-diagnostic/              sanitized (no cookies) copy of the Cloudflare diagnostic
evidence/manual-checks/                      written log of the manual country-selector check (no screenshots could be captured)
```

## 6. What each test does

### Selenium (`selenium/tests`) and Playwright (`playwright/tests`) – identical scenarios, language `/es-cl/`

Calculator (`https://www.riamoneytransfer.com/es-cl/`):

1. **does not accept alphabet characters in the amount field** – types `abc` in "You send"; the field must stay empty.
2. **shows "Please enter a valid amount" when letters are entered** – types `abc`, leaves the field, expects the message in the page.
3. **"Send to" dropdown lets the user select a country (Haiti / HTG)** – opens the destination dialog, checks the search box and that
   several destinations are listed, selects *Haiti* then *HTG* (the picker is two-level: country -> currency) and checks the button now says HTG.
4. **converts 25000 CLP to HTG using the displayed rate** – selects Haiti/HTG, types `25000`, reads the live promo rate from the banner
   (`1 CLP = ... HTG`) and expects *received = 25000 x rate* (tolerance 0.05, the rate is shown with 6 decimals). Ends with 25000 on screen.
5. **recalculates the received amount when the send amount changes (25000 -> 50000)** – same as 4, then types `50000` and expects about 2x.
6. **"Get Started" lands on secure.riamoneytransfer.com** – checks the link's `href`, follows it and waits for the secure login page to render.

Secure site (`https://secure.riamoneytransfer.com/`, redirects to `/login`):

7. **shows Register, phone/email and password** – the username field, the password field and the Register link are visible.
8. **Register navigates to /registration and shows the country selection page** – clicks Register, waits for `/registration`; if the page
   shows the "cannot register from your location" modal it fails with an explicit `GEO-BLOCKED` message, otherwise it expects the country page.

Extra scenario (`ria-register-us`), added because registration is blocked from Chile:

9. **site country selector switches Chile -> United States (/en-us/)** – uses the site's own header selector ("Select language and region" -> Country ->
   United States, found by `aria-label`, `role`, `data-slot` and the link `href`, so it does not depend on the UI language) and checks the site moves to `/en-us/`.
10. **Register after switching to United States shows the country selection page** – then clicks the site's Register link and applies the same check as test 8.
   It fails with `GEO-BLOCKED` when the location blocks registration and is expected to pass from a location where Ria allows it.

**Result of the extra scenario:** both tests stop with `BLOCKED: www /en-us/ answers automation with a bot challenge / 403 (Cloudflare)` in Selenium and
in Playwright (`/en-us/` is challenged for automation although `/es-cl/` is not, and a normal Chrome session loads it). They are not bypassed. What was
observed by hand is in `evidence/manual-checks/2026-10-29-country-selector.md`: the selector goes to `/en-us/`, the Register link is the same
`secure.../registration`, and the page still says registration is not possible from Chile.

Design notes: every calculator test starts from a **fresh browser session** (Selenium starts a new browser per test; Playwright opens a new context per test and
restarts its worker after a failure anyway), so tests do not depend on each other and screenshots are not polluted by earlier tests. Observed on 2026-10-29:
reloading the page inside the *same* Selenium session made Cloudflare challenge the second load of `/es-cl/`, while fresh sessions were not challenged. Both close the cookie banner only if it shows up, and both **stop with a clear
`BLOCKED` message** (no retries) if the site answers with a bot challenge, a 403 or a blank page.

### Cypress (`cypress/e2e`) – same scenarios, 9 tests

Calculator spec (5): letters rejected, valid-amount message, dropdown country, converts 25000 CLP, recalculates on change.
Secure spec (4): Register/phone-email/password present, Register link goes to `/registration`, country selection page, Get Started lands on `secure`.
After each test `cypress/support/e2e.js` saves a screenshot of the whole runner; `--env PAUSE=8000` adds a pause for watching.
The calculator helpers use `cypress-real-events` (real CDP clicks/typing) and wait for React hydration; **because of F5 the calculator
tests could not be executed end to end in Cypress**, so those helpers apply what was verified in Selenium/Playwright but are unverified in Cypress.

### Postman / newman (`postman/ria-api-tests.postman_collection.json`)

**GET** `https://jsonplaceholder.typicode.com/posts/` (4 assertions): status is 200; response is a non-empty array; **every** post has a non-empty
`title` and `body`; **no field of any post** contains the word "zombie" (case-insensitive).
**POST** `https://httpbin.org/post` with the body from the brief (4 assertions): status is 200 or 201; the echoed body matches the request
(`student`, `email_address`); `topping` is **exactly** bacon, cheese and mushroom (3 items); `topping` does not contain chicken.
The negative checks were also verified against a local mock with bad data (zombie, empty title, chicken): they fail as they should.

## 7. Findings for the developer

Observed from Chrome with a Chile IP on 2026-10-28/29. "Suggested severity" is my own judgement.

| ID | Finding | Suggested severity | Evidence |
|---|---|---|---|
| **F1** | **No validation message for letters.** Letters typed in "You send" are silently discarded; "Please enter a valid amount" is never rendered, `aria-invalid` stays `false`. The only validation text is a screen-reader-only hint ("Enter an amount between 1-10000000 CLP."). The acceptance criterion is not met. | Medium | `screenshots/{selenium,playwright}/failed__shows_Please_enter...`, `screenshots/manual-inspection/letters-rejected-no-error-message.jpg` |
| **F2** | **Hint not translated.** On `/es-cl/` that same hint is still in English. | Low | `evidence/latest/playwright.log` (page text dump) |
| **F3** | **Page is usable before it is interactive.** The server-rendered calculator accepts typing and clicks before React hydrates; the input then resets (typed `abc` reverted to `100.000`) and a click on the destination button did nothing. Fast users could hit it too. | Medium (UX) | observed in two development runs; reproduce by acting right after first paint (not captured in the committed evidence) |
| **F4** | **Brief inconsistency after changing the currency.** Right after selecting HTG the promo banner still said COP and the received amount kept the old figure for a moment; final values were correct. Seen once, not reproduced as persistent. | Low (unconfirmed) | observed once during development (screenshot not committed) |
| **F5** | **Anti-bot (Cloudflare) blocks Cypress.** `www.riamoneytransfer.com` (`/es-cl/` and `/en-cl/`) answers Cypress with the "Just a moment..." challenge, HTTP 403, for both `cy.visit` and `cy.request`. Selenium and Playwright with the installed Chrome were not challenged. After many Cypress runs, `secure.*` also began answering Cypress 403 at times. On **`/en-us/`** the challenge also reaches Selenium and Playwright (not `/es-cl/`), which blocks the extra "switch to United States" scenario. This is an environment/testability limitation, not a product bug. | Info | `evidence/cloudflare-diagnostic/` (Ray IDs), `screenshots/cypress/**/failed__*`, `screenshots/{selenium,playwright}/failed__site_country_selector...` |
| **F6** | **Registration is geo-restricted from Chile, and the site's country selector does not change that.** `/registration` shows "Unable to register account – based on your current location you cannot register an account for Chile", so the country selection page cannot be reached from Chile. Switching the site's own selector to United States works (it goes to `/en-us/`) but the registration page still reports Chile: the check uses the real location, not the selector (verified by hand 2026-10-29, log in `evidence/manual-checks/`; the modal's *Got it* button returns to `/es-cl/`). Presumably an intended business rule. | Info | `screenshots/{selenium,playwright,cypress}/failed__Register...`, `screenshots/{selenium,playwright}/failed__Register_after_switching_to_United_States...` |
| **F7** | **"Register" is a link, not a button** (`<a href="/registration">`), unlike the wording of the brief. | Info | secure-site tests |
| **F8** | **Rate banner markup.** The struck-through old rate and the promo rate sit in adjacent elements with no whitespace; plain text extraction glues them (`3,1473,2491 COP`). Assistive tech may read it badly (unverified). | Low (unverified) | seen while writing the rate parser |

**Acceptance data point.** 25000 CLP -> Haiti HTG = **3.298,82 HTG** at the promo rate **0,131953** (struck-through rate 0,12965) on 2026-10-29, and
3.350,82 HTG at 0,134033 on 2026-10-28; 50000 CLP doubles the amount. The rate is live, so the tests derive the expected value from the rate on screen instead of hard-coding it.
Screenshots: the one of the test `converts 25000 CLP to HTG...` in `screenshots/{selenium,playwright}/` (25000 CLP on screen).

## 8. Limitations and decisions

* **Cloudflare was not bypassed.** No spoofed headers, no hidden `navigator.webdriver`, no stealth flags, no cookie reuse. Selenium and Playwright
  use the installed Chrome with default options. If a protection answers with a challenge, 403 or blank page, the suites stop with a `BLOCKED` message.
* **Tests were not weakened.** Findings F1 and F6 stay red, with explicit messages, rather than being skipped or marked as expected failures.
* **Expected values come from the screen** (live rate), and selectors are language-neutral (ids, attributes, `href`, `data-slot`) so they do not depend on the UI language.
* **Location matters.** Results above are from a Chile IP; F6 depends on it, and the calculator locale is pinned with `/es-cl/`. To see the country selection page, the suites would have to run from a location where Ria allows registration (the extra scenario is written for it, but `/en-us/` is currently challenged for automation, see F5). Changing the real network location (VPN, etc.) is deliberately not automated here.
* **Live site and live APIs.** Rates, the promo banner and the third-party APIs can change; the suites read values from the page instead of assuming them.
* **No data is submitted.** The tests never log in, never create accounts and never fill the register form.
* **Cypress was not extended with the extra scenario:** `www` is challenged by Cloudflare there (F5), so it could not be verified.

## 9. Evidence

Generated by `npm run evidence` (the script wipes and recreates these folders):

```
evidence/latest/SUMMARY.txt               exit code of each suite + list of generated files
evidence/latest/run-info.txt              date, Node/npm/Playwright/Cypress versions, pause
evidence/latest/postman.log, newman-results.json, newman-report.html
evidence/latest/selenium.log, playwright.log, cypress.log, playwright-results.json
screenshots/results/                      result summaries: selenium-, playwright-, cypress-, postman-results.png (rendered from the logs)
screenshots/postman/newman-report.png     screenshot of the newman HTML report
screenshots/selenium/                     10 test screenshots + step__send-to-dropdown-open.png (all with a URL label)
screenshots/playwright/                   10 test screenshots + step__send-to-dropdown-open.png (all with a URL label)
screenshots/cypress/<spec>/               one screenshot per executed Cypress test (passed__* / failed__*)
```
Git-ignored and regenerable: the Playwright HTML report and traces (`npm run pw:test && npm run pw:report`), `postman/newman-report.html`, `diagnostics/`.

## 10. Troubleshooting

* **Cypress says its binary is missing** – npm blocked its install script: run `npx cypress install`.
* **Cypress window opens blank** (macOS GPU rendering): `ELECTRON_EXTRA_LAUNCH_ARGS="--disable-gpu" npm run cy:open`, or use `npm run cy:watch`.
* **`Bad CPU type in executable ... term-size`** (Apple Silicon without Rosetta) – harmless, only affects the terminal width.
* **`BLOCKED:` message** – the site challenged the automation (see F5). It is reported, never retried or bypassed.
* **`GEO-BLOCKED:` message** – registration is not offered from your location (see F6).
* **A test fails right after the page loads** – the page was not interactive yet (see F3); the helpers wait for hydration, so report it if it still happens.
