const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const routes = [
    { name: '首页 /', path: '/' },
    { name: '生成中 /generating', path: '/generating' },
    { name: '404 /unknown', path: '/unknown' },
    { name: '分享 /share/abc123', path: '/share/abc123' },
    { name: '历史 /history', path: '/history' },
  ];

  const results = [];

  for (const { name, path } of routes) {
    try {
      await page.goto(`http://localhost:5173${path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.screenshot({
        path: `screenshots/${name.replace(/[\/ ]/g, '_')}.png`,
        fullPage: true,
      });
      const title = await page.title();
      const text = await page.textContent('body');
      const preview = text?.substring(0, 120)?.replace(/\s+/g, ' ') ?? '';
      results.push({ name, path, status: '✅', title, preview });
    } catch (err) {
      results.push({
        name,
        path,
        status: `❌ ${err.message.substring(0, 80)}`,
        title: '-',
        preview: '-',
      });
    }
  }

  await browser.close();

  console.log('\n===== 路由渲染结果 =====');
  for (const r of results) {
    console.log(`${r.status} [${r.name}] ${r.path}`);
    console.log(`   title: ${r.title}`);
    console.log(`   preview: ${r.preview}`);
    console.log();
  }
})();
