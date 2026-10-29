#!/usr/bin/env bash
# Runs Postman -> Selenium -> Playwright -> Cypress and stores ALL evidence under evidence/latest and screenshots/.
# Failing tests are EXPECTED (see README): the script never stops on them, it reports each exit code.
cd "$(dirname "$0")/.." || exit 1
EV=evidence/latest
PAUSE="${PAUSE:-6000}"

rm -rf "$EV" screenshots/selenium screenshots/playwright screenshots/cypress screenshots/postman screenshots/results \
  screenshots/ria-calculator.cy.js screenshots/ria-secure-registration.cy.js cypress/screenshots  # stale folders from earlier manual runs
mkdir -p "$EV" screenshots/postman

{ echo "date:       $(date '+%Y-%m-%d %H:%M:%S %z')"; echo "node:       $(node -v)"; echo "npm:        $(npm -v)";
  echo "playwright: $(npx playwright --version 2>/dev/null | head -1)"; echo "cypress:    $(npx cypress -v 2>/dev/null | head -1)";
  echo "os:         $(uname -sr)"; echo "pause:      ${PAUSE} ms"; } > "$EV/run-info.txt"

echo; echo "=================== 1/4  POSTMAN (newman) ==================="
npx newman run postman/ria-api-tests.postman_collection.json \
  -r cli,json,htmlextra \
  --reporter-json-export "$EV/newman-results.json" \
  --reporter-htmlextra-export "$EV/newman-report.html" 2>&1 | tee "$EV/postman.log"
PM=${PIPESTATUS[0]}
node scripts/screenshot-report.js "$EV/newman-report.html" screenshots/postman/newman-report.png || echo "(report screenshot failed)"

echo; echo "=================== 2/4  SELENIUM ==================="
PAUSE="$PAUSE" npx mocha selenium/tests --timeout 120000 --reporter spec 2>&1 | tee "$EV/selenium.log"
SE=${PIPESTATUS[0]}

echo; echo "=================== 3/4  PLAYWRIGHT ==================="
PAUSE="$PAUSE" npx playwright test 2>&1 | tee "$EV/playwright.log"
PW=${PIPESTATUS[0]}

echo; echo "=================== 4/4  CYPRESS ==================="
npx cypress run --browser chrome --headed --env PAUSE="$PAUSE" 2>&1 | tee "$EV/cypress.log"
CY=${PIPESTATUS[0]}

# keep personal paths out of the committed evidence (public repo)
HOME_ESC=$(printf '%s' "$HOME" | sed 's/[#&/\]/\\&/g'); PROJ_ESC=$(printf '%s' "$PWD" | sed 's/[#&/\]/\\&/g')
for f in "$EV"/*.log "$EV"/*.json; do [ -f "$f" ] && sed -i.bak "s#$PROJ_ESC#<project>#g; s#$HOME_ESC#<home>#g" "$f" && rm -f "$f.bak"; done

# result-summary screenshots (what the brief asks for): rendered from the already anonymized logs
mkdir -p screenshots/results
node scripts/render-results.js plain "$EV/postman.log" "Postman / newman - results" screenshots/results/postman-results.png || echo "(postman results screenshot failed)"
node scripts/render-results.js mocha "$EV/selenium.log" "Selenium (Mocha) - results" screenshots/results/selenium-results.png || echo "(selenium results screenshot failed)"
node scripts/render-results.js playwright "$EV/playwright.log" "Playwright - results" screenshots/results/playwright-results.png || echo "(playwright results screenshot failed)"
node scripts/render-results.js cypress "$EV/cypress.log" "Cypress - results" screenshots/results/cypress-results.png || echo "(cypress results screenshot failed)"

{
  echo "Exit codes (0 = all green; number = failing tests):"
  echo "  postman    (newman): $PM   expected 0"
  echo "  selenium   (mocha) : $SE   expected 4 (valid-amount message, geo-blocked registration, 2 extra tests blocked on /en-us/)"
  echo "  playwright         : $PW   expected 1 (Playwright returns 1 for any failure; same four findings)"
  echo "  cypress            : $CY   expected >0 if Cloudflare challenges www (see README)"
  echo
  echo "Evidence files:"
  find "$EV" screenshots -type f \( -name '*.png' -o -name '*.log' -o -name '*.json' -o -name '*.html' -o -name '*.txt' \) \
    -not -path 'screenshots/manual-inspection/*' -not -path '*/playwright-report/*' -not -path '*/playwright-test-results/*' | sort
} | tee "$EV/SUMMARY.txt"
