const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const EDGEEXE = process.env.EDGEEXE;
const OUT = process.env.SHOBI_OUT || path.join(process.cwd(), 'vanilla-28-capture.json');
const URL = 'https://www.fragrantica.com/perfume/Kayali-Fragrances/Vanilla-28-52616.html';

function clean(decoded) {
  if (!decoded || !Array.isArray(decoded.notes) || !decoded.notes.length || !decoded.weights_sum) return null;
  const level = id => {
    if (decoded.pyramid?.top?.some(n => n.sastojak_id === id)) return 'top';
    if (decoded.pyramid?.middle?.some(n => n.sastojak_id === id)) return 'middle';
    if (decoded.pyramid?.base?.some(n => n.sastojak_id === id)) return 'base';
    return null;
  };
  return {
    perfume: 'Vanilla 28 Kayali Fragrances',
    url: URL,
    weights_sum: decoded.weights_sum,
    captured_at: new Date().toISOString(),
    notes: decoded.notes.map((n, i) => ({
      rank: i + 1,
      note: n.pyramid_title || n.engleski || n.note_title,
      sastojak_id: n.sastojak_id,
      weight: n.weight,
      percentage: +(n.weight / decoded.weights_sum * 100).toFixed(2),
      pyramid_level: level(n.sastojak_id)
    }))
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGEEXE, headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__shobiDecodedCaptures = [];
    const capture = value => {
      try {
        if (value && Array.isArray(value.notes) && value.notes.length && value.weights_sum) {
          window.__shobiDecodedCaptures.push(value);
        }
      } catch {}
    };

    try {
      const nativeThen = Promise.prototype.then;
      Promise.prototype.then = function(onFulfilled, onRejected) {
        const wrapped = typeof onFulfilled === 'function'
          ? function(value) { capture(value); return onFulfilled.apply(this, arguments); }
          : function(value) { capture(value); return value; };
        return nativeThen.call(this, wrapped, onRejected);
      };
    } catch {}

    try {
      let nativePd;
      let wrappedPd;
      const wrap = fn => function(...args) {
        const result = fn.apply(this, args);
        Promise.resolve(result).then(capture);
        return result;
      };
      Object.defineProperty(window, '_pd', {
        configurable: true,
        get() { return wrappedPd || nativePd; },
        set(fn) { nativePd = fn; wrappedPd = typeof fn === 'function' ? wrap(fn) : fn; }
      });
    } catch {}
  });

  const response = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('STATUS=' + (response ? response.status() : 'NO_RESPONSE'));
  console.log('TITLE=' + await page.title());

  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const h = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    for (const f of [0.2, 0.4, 0.6, 0.8, 1]) {
      window.scrollTo(0, Math.floor(h * f));
      await sleep(300);
    }
    window.scrollTo(0, Math.floor(h * 0.45));
  });

  try {
    await page.waitForFunction(() => window.__shobiDecodedCaptures?.length > 0, null, { timeout: 20000 });
  } catch {}

  const decoded = await page.evaluate(() => window.__shobiDecodedCaptures?.at(-1) || null);
  const result = clean(decoded);

  if (result) {
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
    console.log('CAPTURE_OK notes=' + result.notes.length + ' weights_sum=' + result.weights_sum);
  } else {
    const diagnostic = {
      captured: false,
      url: page.url(),
      title: await page.title(),
      html_length: (await page.content()).length,
      captured_candidates: await page.evaluate(() => window.__shobiDecodedCaptures?.length || 0),
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(OUT, JSON.stringify(diagnostic, null, 2) + '\n');
    console.log('CAPTURE_MISS candidates=' + diagnostic.captured_candidates);
  }

  await browser.close();
})().catch(err => {
  console.error('CAPTURE_FATAL=' + (err?.stack || err));
  process.exit(2);
});
