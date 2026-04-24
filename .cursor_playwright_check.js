const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const baseUrl =
    process.env.URL || 'http://localhost:53631/reader.html#topic=tech';
  const out = { url: baseUrl, results: {}, screenshots: [] };
  const consoleMessages = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error')
      consoleMessages.push({ type: 'console', text: msg.text() });
  });
  page.on('pageerror', (err) => {
    consoleMessages.push({ type: 'pageerror', text: err.message });
  });

  await context.addInitScript(() => {
    localStorage.setItem(
      'linguistfeed_user',
      JSON.stringify({
        id: 1,
        email: 'playwright@test.local',
        username: 'pw',
      })
    );
    localStorage.setItem('token', 'playwright-test-token');
    localStorage.setItem('user-level', 'B1');
  });

  const outDir = path.join(process.cwd(), 'cursor_agent_playwright_output');
  fs.mkdirSync(outDir, { recursive: true });

  try {
    const resp = await page.goto(baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    out.results.httpStatus = resp ? resp.status() : null;

    await page.waitForSelector('#articles-container', { timeout: 15000 });
    await page
      .waitForSelector('#articles-container .card', { timeout: 25000 })
      .catch(() => {});

    const domChecks = await page.evaluate(() => ({
      initSearchType: typeof window.initSearch,
      hasSearchBar: !!document.getElementById('searchBarCategory'),
      cardCount: document.querySelectorAll('#articles-container .card').length,
      articleCardCount: document.querySelectorAll('#articles-container .article-card')
        .length,
    }));
    out.results.domChecks = domChecks;

    const s1 = path.join(outDir, 'reader_initial.png');
    await page.screenshot({ path: s1, fullPage: true });
    out.screenshots.push(s1);

    if (domChecks.hasSearchBar) {
      await page.fill('#searchBarCategory', '');
      await page.type('#searchBarCategory', 'NASA', { delay: 30 });
      await page.waitForTimeout(500);
      const visibleAfterSearch = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#articles-container .card')).filter(
          (n) => n.offsetParent !== null
        ).length
      );
      out.results.searchTest = { query: 'NASA', visibleCardCount: visibleAfterSearch };
      const s2 = path.join(outDir, 'reader_after_search.png');
      await page.screenshot({ path: s2, fullPage: true });
      out.screenshots.push(s2);
      // Restaurar lista para clics en .level-btn (evitar botón en tarjeta oculta)
      await page.fill('#searchBarCategory', '');
      await page.dispatchEvent('#searchBarCategory', 'input');
      await page.waitForTimeout(400);
      out.results.searchClearedVisibleCards = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#articles-container .card')).filter(
          (n) => n.offsetParent !== null
        ).length
      );
    } else {
      out.results.searchTest = { error: 'searchBarCategory not found' };
    }

    const levelBtnInfo = await page.evaluate(() => {
      const btn = document.querySelector(
        '#articles-container .card .level-btn'
      );
      if (!btn) return { found: false };
      const style = window.getComputedStyle(btn);
      return {
        found: true,
        text: (btn.textContent || '').trim(),
        color: style.color,
        fontSize: style.fontSize,
        display: style.display,
        visibility: style.visibility,
      };
    });
    out.results.levelBtn = levelBtnInfo;

    if (levelBtnInfo.found) {
      await page
        .locator('#articles-container .card')
        .first()
        .locator('.level-btn')
        .first()
        .click({ timeout: 15000 });
      await page.waitForTimeout(200);
      const readClicked = await page.evaluate(() => {
        const card = Array.from(
          document.querySelectorAll('#articles-container .card')
        ).find((n) => n.offsetParent !== null);
        if (!card) return false;
        const a = Array.from(card.querySelectorAll('a')).find((x) =>
          (x.textContent || '').includes('Read')
        );
        if (a) {
          a.click();
          return true;
        }
        return false;
      });
      out.results.readClick = readClicked;
      await page.waitForTimeout(1200);
      out.results.finalUrl = page.url();
      const s3 = path.join(outDir, 'reader_after_read.png');
      await page.screenshot({ path: s3, fullPage: true }).catch(() => {});
      out.screenshots.push(s3);
    }

    await page.waitForTimeout(300);
    out.results.consoleErrors = consoleMessages;

    const outPath = path.join(outDir, 'playwright_result.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
    process.exit(0);
  } catch (err) {
    out.error = err.stack || String(err);
    out.results.consoleErrors = consoleMessages;
    const outPath = path.join(outDir, 'playwright_result.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
    console.error('PLAYWRIGHT_ERROR:', out.error);
    try {
      await browser.close();
    } catch (e) {}
    process.exit(4);
  }
})();
