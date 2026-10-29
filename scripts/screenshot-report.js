// Takes a PNG of an HTML file (used for the newman/Postman report) with Selenium.
// usage: node scripts/screenshot-report.js <report.html> <out.png>
const { Builder } = require('selenium-webdriver');
const path = require('path');
const fs = require('fs');

(async () => {
  const [, , input, output] = process.argv;
  if (!input || !output) throw new Error('usage: screenshot-report.js <report.html> <out.png>');
  const url = 'file://' + path.resolve(input);
  const driver = await new Builder().forBrowser('chrome').build();
  try {
    await driver.manage().window().setRect({ width: 1400, height: 1000 });
    await driver.get(url);
    await driver.sleep(2500); // report loads bootstrap/charts
    const height = await driver.executeScript('return Math.min(document.documentElement.scrollHeight, 6000)');
    await driver.manage().window().setRect({ width: 1400, height: Math.max(height + 120, 1000) });
    await driver.sleep(500);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, await driver.takeScreenshot(), 'base64');
    console.log('saved', output);
  } finally {
    await driver.quit();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
