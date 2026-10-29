# Manual check: site country selector -> United States -> Register

Done by hand in a normal Chrome session (not automated), Chile IP, 2026-10-29. Nothing was typed into any form.
No screenshots of the secure pages could be captured in that session (the capture timed out), so this is a written log.

| Step | What was done | What was observed |
|---|---|---|
| 1 | Open `https://www.riamoneytransfer.com/es-cl/` | Page loads normally (no Cloudflare challenge) |
| 2 | Header flag button "Select language and region" | Popover with two rows: "Idioma / Español" and "País / Chile" |
| 3 | Row "País" | Country list with a search box ("Search countries"); countries are links (`/es-cl/`, `/en-cl/`, `/fr-cl/`, `/de-de/`, ... 44 links) |
| 4 | Search "Estados Unidos" and pick it | Navigates to `https://www.riamoneytransfer.com/en-us/` (English, "Send Money from the U.S. ...") |
| 5 | Click the header "Register" link | Link target is plain `https://secure.riamoneytransfer.com/registration` (no country parameter); lands on `/registration` |
| 6 | Read the page | Modal "No se ha podido registrar la cuenta - Según tu ubicación actual, no puedes registrar una cuenta en Chile" (still Chile) |
| 7 | Click the modal button "Entendido" | Goes back to `https://www.riamoneytransfer.com/es-cl/` (the site returns to Chile) |

Conclusions
* The site's country selector works as navigation (`/en-us/`), but it does **not** change the registration restriction:
  the secure site decides with the visitor's real location ("Según tu ubicación actual").
* The country selection page asked for by the challenge was therefore **not reachable from Chile**, with or without the selector.
* Automating steps 2-5 with Selenium/Playwright is blocked: `/en-us/` answers automation with the Cloudflare challenge
  (`BLOCKED:` message in the extra tests), although a normal Chrome session loads it. Not bypassed.
