/**
 * Playwright smoke: reader.html — DOM, búsqueda, .level-btn, Read → URL con level=
 * Uso: node .cursor_playwright_check.js --url "http://localhost:PUERTO/reader.html#topic=tech"
 *      LOCALSTORAGE_JSON='{"token":"x"}' node .cursor_playwright_check.js --url "..."
 * Salida: cursor_agent_playwright_output/playwright_result.json
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function parseBaseUrl() {
  const argv = process.argv.slice(2);
  let u = process.env.URL || null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) {
      u = argv[i + 1];
      i++;
    }
  }
  if (!u) u = 'http://localhost:53631/reader.html#topic=tech';
  return u;
}

function hashParams(url) {
  try {
    const h = new URL(url).hash;
    if (!h || h.length < 2) return new URLSearchParams();
    return new URLSearchParams(h.substring(1));
  } catch {
    return new URLSearchParams();
  }
}

(async () => {
  const baseUrl = parseBaseUrl();
  const out = {
    url: baseUrl,
    results: {},
    screenshots: [],
    flags: {},
  };
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

  const localJson = process.env.LOCALSTORAGE_JSON;
  if (localJson) {
    await context.addInitScript(
      `window.__INJECTED_LOCALSTORAGE = ${localJson}; for (const k in window.__INJECTED_LOCALSTORAGE) localStorage.setItem(k, window.__INJECTED_LOCALSTORAGE[k]);`
    );
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

  const outDir = path.join(process.cwd(), 'cursor_agent_playwright_output');
  fs.mkdirSync(outDir, { recursive: true });

  const writeOut = (extra) => {
    const o = { ...out, ...extra };
    o.results = o.results || {};
    o.results.consoleErrors = consoleMessages;
    const outPath = path.join(outDir, 'playwright_result.json');
    fs.writeFileSync(outPath, JSON.stringify(o, null, 2), 'utf8');
    return o;
  };

  try {
    const resp = await page.goto(baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    out.results.httpStatus = resp ? resp.status() : null;
    if (resp && resp.status() === 404) {
      out.results.readableMessage =
        'HTTP 404: el --url apunta a un host/puerto que no sirve este frontend. Usa el puerto de `npm run dev` o `npx serve frontend` de este repositorio.';
      const s404 = path.join(outDir, 'reader_404.png');
      await page.screenshot({ path: s404, fullPage: true }).catch(() => {});
      out.screenshots.push(s404);
      writeOut({});
      console.log(JSON.stringify(out, null, 2));
      await browser.close();
      process.exit(2);
    }

    await page.waitForTimeout(800);
    if (/login\.html/i.test(page.url())) {
      out.flags.LOGIN_REQUIRED = true;
      out.results.readableMessage =
        'La página redirigió a login. Define LOCALSTORAGE_JSON con un objeto de claves/valores de localStorage, o pega en el chat el JSON de sesión local.';
      const s0 = path.join(outDir, 'login_redirect.png');
      await page.screenshot({ path: s0, fullPage: true });
      out.screenshots.push(s0);
      writeOut({});
      console.log(JSON.stringify(out, null, 2));
      await browser.close();
      process.exit(0);
    }

    await page.waitForSelector('#articles-container', { timeout: 20000 });
    await page
      .waitForSelector('#articles-container .card', { timeout: 30000 })
      .catch(() => {});

    const domChecks = await page.evaluate(() => ({
      initSearchType: typeof window.initSearch,
      hasSearchBar: !!document.getElementById('searchBarCategory'),
      cardCount: document.querySelectorAll('#articles-container .card')
        .length,
    }));
    out.results.domChecks = domChecks;

    const s1 = path.join(outDir, 'reader_initial.png');
    await page.screenshot({ path: s1, fullPage: true });
    out.screenshots.push(s1);

    if (domChecks.hasSearchBar) {
      await page.fill('#searchBarCategory', '');
      await page.type('#searchBarCategory', 'NASA', { delay: 25 });
      await page.waitForTimeout(600);
      const visibleAfterSearch = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll('#articles-container .card')
        ).filter((n) => n.offsetParent !== null).length
      );
      out.results.searchTest = { query: 'NASA', visibleCardCount: visibleAfterSearch };
      const s2 = path.join(outDir, 'reader_after_search.png');
      await page.screenshot({ path: s2, fullPage: true });
      out.screenshots.push(s2);

      await page.fill('#searchBarCategory', '');
      await page.dispatchEvent('#searchBarCategory', 'input');
      await page.waitForTimeout(500);
      out.results.searchClearedVisibleCards = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll('#articles-container .card')
        ).filter((n) => n.offsetParent !== null).length
      );
    } else {
      out.results.searchTest = { error: 'searchBarCategory not found' };
    }

    const errText = await page.evaluate(
      () => document.getElementById('articles-container')?.innerText || ''
    );
    if (
      /Error connecting to server|login\.html/i.test(errText) &&
      !domChecks.cardCount
    ) {
      if (/login|sign in|iniciar sesión/i.test(errText) || /login/.test(page.url())) {
        out.flags.LOGIN_REQUIRED = true;
        out.results.readableMessage =
          'Contenido bloqueado o requiere sesión. Pega localStorage JSON o ajusta LOCALSTORAGE_JSON.';
      }
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
      // Elegir un nivel no por defecto (B1) para comprobar level= en la URL
      const chosen = await page.evaluate(() => {
        const card = document.querySelector('#articles-container .card');
        if (!card) return { level: null, err: 'no card' };
        const c1 = card.querySelector('.level-btn[id$="-C1"]');
        if (c1) {
          c1.click();
          return { level: (c1.textContent || '').trim() };
        }
        const a2 = card.querySelector('.level-btn[id$="-A2"]');
        if (a2) {
          a2.click();
          return { level: (a2.textContent || '').trim() };
        }
        const btns = card.querySelectorAll('.level-btn');
        if (btns[4]) {
          btns[4].click();
          return { level: (btns[4].textContent || '').trim() };
        }
        return { level: null, err: 'no level buttons' };
      });
      out.results.selectedLevelForTest = (chosen && chosen.level) || '';
      await page.waitForTimeout(400);

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

      await page.waitForFunction(
        () => {
          const h = window.location.hash;
          return /level=/.test(h) && /id=/.test(h);
        },
        { timeout: 20000 }
      );
      await page.waitForTimeout(500);

      const finalU = page.url();
      out.results.finalUrl = finalU;
      const p = hashParams(finalU);
      out.results.urlLevelParam = p.get('level') || null;
      const sel = (out.results.selectedLevelForTest || '').trim();
      out.results.urlIncludesSelectedLevel = !!(
        sel && new RegExp(`level=${sel}(?:&|$|#)`).test(finalU.replace(/.*#/, '#'))
      );

      const s3 = path.join(outDir, 'reader_after_read.png');
      await page.screenshot({ path: s3, fullPage: true }).catch(() => {});
      out.screenshots.push(s3);
    }

    out.results.consoleErrors = consoleMessages;
    writeOut({});
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
    process.exit(0);
  } catch (err) {
    out.error = err.stack || String(err);
    out.results.consoleErrors = consoleMessages;
    if (/login|unauthoriz|401/i.test(String(err))) {
      out.flags.LOGIN_REQUIRED = true;
    }
    writeOut({ error: out.error });
    console.error('PLAYWRIGHT_ERROR:', out.error);
    try {
      const sErr = path.join(outDir, 'reader_error.png');
      await page.screenshot({ path: sErr, fullPage: true }).catch(() => {});
      out.screenshots.push(sErr);
      writeOut({ error: out.error, screenshots: out.screenshots });
    } catch (e) {
      // ignore
    }
    try {
      await browser.close();
    } catch (e) {}
    process.exit(4);
  }
})();
