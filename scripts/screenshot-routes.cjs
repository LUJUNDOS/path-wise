const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const routes = [
    { name: '01_home', path: '/' },
    { name: '02_404', path: '/unknown' },
    { name: '03_share', path: '/share/abc123' },
    { name: '04_history', path: '/history' },
  ];

  for (const { name, path: route } of routes) {
    try {
      await page.goto(`http://localhost:5173${route}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });
      await new Promise((r) => setTimeout(r, 800));
      await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
      console.log(`screenshot: screenshots/${name}.png`);
    } catch (err) {
      console.log(`FAIL: ${route} - ${err.message.substring(0, 80)}`);
    }
  }

  await browser.close();
  console.log('Done');
})();
