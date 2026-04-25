const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function parseUrlArg() {
  const args = process.argv.slice(2);
  let u = process.env.URL || null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      u = args[i + 1];
      i += 1;
    }
  }
  return u || 'http://localhost:53631/reader.html#topic=tech';
}

(async () => {
  const baseUrl = parseUrlArg();
  const out = {
    url: baseUrl,
    results: {},
    screenshots: [],
  };
  const consoleMessages = [];

  const outDir = path.join(process.cwd(), 'cursor_agent_playwright_output');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleMessages.push({ type: 'console', text: msg.text() });
  });
  page.on('pageerror', (err) => {
    consoleMessages.push({ type: 'pageerror', text: err.message });
  });

  if (process.env.LOCALSTORAGE_JSON) {
    const parsed = JSON.parse(process.env.LOCALSTORAGE_JSON);
    await context.addInitScript((o) => {
      window.__INJECTED_LOCALSTORAGE = o;
      for (const k in window.__INJECTED_LOCALSTORAGE) {
        const v = window.__INJECTED_LOCALSTORAGE[k];
        localStorage.setItem(
          k,
          typeof v === 'string' ? v : JSON.stringify(v)
        );
      }
    }, parsed);
  } else {
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
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const saveJson = () => {
    const outPath = path.join(outDir, 'playwright_result.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  };

  let selectedLevel = null;
  const failLogin = (reason) => {
    out.status = 'LOGIN_REQUIRED';
    out.error = reason;
    out.message =
      'La página requiere sesión válida o se redirigió a login. Pega un LOCALSTORAGE_JSON o autoriza automatizar el login con credenciales de prueba local.';
    saveJson();
  };

  try {
    const resp = await page.goto(baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    out.results.httpStatus = resp ? resp.status() : null;

    await sleep(500);
    if (page.url().includes('login.html')) {
      out.results.loginPageDetected = true;
      const pLogin = path.join(outDir, 'login_required.png');
      await page.screenshot({ path: pLogin, fullPage: true });
      out.screenshots.push(pLogin);
      failLogin('Navegación a login.html');
      await browser.close();
      console.log(JSON.stringify(out, null, 2));
      process.exit(0);
    }

    await page.waitForSelector('#articles-container', { timeout: 20000 });
    await page
      .waitForSelector('#articles-container .card', { timeout: 30000 })
      .catch(() => {});

    const initSearchType = await page.evaluate(() => typeof window.initSearch);
    const hasSearchBar = await page.evaluate(
      () => !!document.getElementById('searchBarCategory')
    );
    const cardCount = await page.evaluate(
      () => document.querySelectorAll('#articles-container .card').length
    );

    out.results.checks = {
      'typeof window.initSearch': initSearchType,
      hasSearchBarCategory: hasSearchBar,
      totalCards: cardCount,
    };
    out.results.domChecks = {
      initSearchType,
      hasSearchBar,
      cardCount,
    };

    const s1 = path.join(outDir, 'reader_initial.png');
    await page.screenshot({ path: s1, fullPage: true });
    out.screenshots.push(s1);

    if (hasSearchBar) {
      await page.fill('#searchBarCategory', '');
      await page.fill('#searchBarCategory', 'NASA');
      await page.dispatchEvent('#searchBarCategory', 'input');
      await sleep(600);
      const visibleAfterSearch = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#articles-container .card')).filter(
          (n) => n.offsetParent !== null
        ).length
      );
      out.results.searchTest = {
        query: 'NASA',
        visibleCardCount: visibleAfterSearch,
      };
      const s2 = path.join(outDir, 'reader_after_search.png');
      await page.screenshot({ path: s2, fullPage: true });
      out.screenshots.push(s2);
      await page.fill('#searchBarCategory', '');
      await page.dispatchEvent('#searchBarCategory', 'input');
      await sleep(500);
    } else {
      out.results.searchTest = { error: 'searchBarCategory not found' };
    }

    const levelBtnInfo = await page.evaluate(() => {
      const btn = document.querySelector('#articles-container .card .level-btn');
      if (!btn) return { found: false };
      const style = window.getComputedStyle(btn);
      return {
        found: true,
        text: (btn.textContent || '').trim(),
        id: btn.id || null,
        color: style.color,
        fontSize: style.fontSize,
        display: style.display,
        visibility: style.visibility,
      };
    });
    out.results.levelBtn = levelBtnInfo;
    if (levelBtnInfo.found && (levelBtnInfo.id || levelBtnInfo.text)) {
      const m = (levelBtnInfo.id || '').match(/-(A1|A2|B1|B2|C1|C2)$/i);
      if (m) selectedLevel = m[1].toUpperCase();
      if (!selectedLevel) {
        const t = (levelBtnInfo.text || '').trim();
        if (/^(A1|A2|B1|B2|C1|C2)$/.test(t)) selectedLevel = t;
      }
    }

    if (levelBtnInfo.found) {
      await page
        .locator('#articles-container .card')
        .first()
        .locator('.level-btn')
        .first()
        .click({ timeout: 15000 });
      await sleep(200);
      if (!selectedLevel) {
        selectedLevel = await page.evaluate(() => {
          const a = document.querySelector(
            '#articles-container .card .level-btn.active'
          );
          const id = a && a.id ? a.id : '';
          const m = id.match(/-(A1|A2|B1|B2|C1|C2)$/i);
          if (m) return m[1].toUpperCase();
          return (a && a.textContent ? a.textContent : '').trim();
        });
      }
      const readClicked = await page.evaluate(() => {
        const card = Array.from(
          document.querySelectorAll('#articles-container .card')
        ).find((n) => n.offsetParent !== null);
        if (!card) return false;
        const a = Array.from(card.querySelectorAll('a')).find((x) =>
          (x.textContent || '').toLowerCase().includes('read')
        );
        if (a) {
          a.click();
          return true;
        }
        return false;
      });
      out.results.readClick = readClicked;
      await page
        .waitForFunction(
          () =>
            (location.hash && /id=/.test(location.hash) && /level=/.test(location.hash)) ||
            false,
          { timeout: 20000 }
        )
        .catch(() => {});
      await sleep(800);
      out.results.finalUrl = page.url();
      const h = (() => {
        try {
          return new URL(page.url()).hash.replace(/^#/, '') || '';
        } catch (e) {
          return '';
        }
      })();
      const p = new URLSearchParams(h);
      out.results.urlLevel = p.get('level') || p.get('Level');
      if (out.results.urlLevel) {
        out.results.levelInUrl = out.results.urlLevel;
      }
      out.results.levelParamMatches = !!(
        selectedLevel &&
        out.results.urlLevel &&
        String(out.results.urlLevel) === String(selectedLevel)
      );
      const s3 = path.join(outDir, 'reader_after_read.png');
      await page.screenshot({ path: s3, fullPage: true }).catch(() => {});
      out.screenshots.push(s3);
    } else {
      out.results.readClick = false;
      out.results.finalUrl = page.url();
    }

    out.results.consoleErrors = consoleMessages;
    saveJson();
    const str = JSON.stringify(out, null, 2);
    console.log(str);
    await browser.close();
    process.exit(0);
  } catch (err) {
    out.error = err.stack || String(err);
    if (!out.status && (String(err).includes('login') || /login\.html/.test(String(out.results.finalUrl || '')))) {
      out.status = 'LOGIN_REQUIRED';
    }
    out.results.consoleErrors = consoleMessages;
    if (!out.screenshots.includes(path.join(outDir, 'reader_error.png'))) {
      try {
        const pe = path.join(outDir, 'reader_error.png');
        await page.screenshot({ path: pe, fullPage: true });
        out.screenshots.push(pe);
      } catch (e) {}
    }
    saveJson();
    console.error('PLAYWRIGHT_ERROR:', out.error);
    try {
      await browser.close();
    } catch (e) {}
    if (out.status === 'LOGIN_REQUIRED') {
      console.log(JSON.stringify(out, null, 2));
      process.exit(0);
    }
    process.exit(4);
  }
})();
