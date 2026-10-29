Cypress connectivity diagnostic (cypress/diagnostics/step1-connect.cy.js), 2026-10-28, Chile IP.
www.* answered the Cypress browser with the Cloudflare challenge (HTTP 403 "Just a moment..."). Cookie headers removed.

step1-request-0.json     403    https://www.riamoneytransfer.com/es-cl/   server=cloudflare ray=a51aeed46af3ae89-JAX
step1-request-1.json     403    https://www.riamoneytransfer.com/en-cl/   server=cloudflare ray=a51aec6e2b6160c7-JAX
step1-request-2.json     200    https://secure.riamoneytransfer.com/login   
step1-visit-0.json       visit  https://www.riamoneytransfer.com/es-cl/  title=Just a moment... 
step1-visit-1.json       visit  https://www.riamoneytransfer.com/en-cl/  title=Just a moment... 
step1-visit-2.json       visit  https://secure.riamoneytransfer.com/login  title=Log in or register 
