const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const EDGEEXE = process.env.EDGEEXE;
const OUT = process.env.SHOBI_OUT || path.join(process.cwd(), 'vanilla-28-capture.json');
const PROFILE = process.env.SHOBI_PROFILE || 'C:\\Shobi\\EdgeProfile';
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
  fs.mkdirSync(PROFILE, { recursive: true });
  console.log('PROFILE=' + PROFILE);

  const context = await chromium.launchPersistentContext(PROFILE, {
    executablePath: EDGEEXE,
    headless: false,
    locale: 'en-US',
    viewport: { width: 1365, height: 900 }
  });

  const pages = context.pages();
  const page = pages[0] || await context.newPage();

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

  const response = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  console.log('STATUS=' + (response ? response.status() : 'NO_RESPONSE'));

  // Give normal browser-side checks time to finish. If an interstitial remains,
  // we report it instead of trying to circumvent it.
  const deadline = Date.now() + 60000;
  let title = await page.title();
  while (/just a moment/i.test(title) && Date.now() < deadline) {
    await page.waitForTimeout(3000);
    title = await page.title();
    console.log('WAITING_TITLE=' + title);
  }
  console.log('TITLE=' + title);

  if (!/just a moment/i.test(title)) {
    await page.waitForTimeout(1500);
    await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const h = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
      for (const f of [0.2, 0.4, 0.6, 0.8, 1]) {
        window.scrollTo(0, Math.floor(h * f));
        await sleep(400);
      }
      window.scrollTo(0, Math.floor(h * 0.45));
    });

    try {
      await page.waitForFunction(() => window.__shobiDecodedCaptures?.length > 0, null, { timeout: 25000 });
    } catch {}
  }

  const decoded = await page.evaluate(() => window.__shobiDecodedCaptures?.at(-1) || null);
  const result = clean(decoded);

  if (result) {
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
    console.log('CAPTURE_OK notes=' + result.notes.length + ' weights_sum=' + result.weights_sum);
  } else {
    const diagnostic = {
      captured: false,
      persistent_profile: PROFILE,
      url: page.url(),
      title: await page.title(),
      html_length: (await page.content()).length,
      captured_candidates: await page.evaluate(() => window.__shobiDecodedCaptures?.length || 0),
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(OUT, JSON.stringify(diagnostic, null, 2) + '\n');
    console.log('CAPTURE_MISS candidates=' + diagnostic.captured_candidates + ' title=' + diagnostic.title);
  }

  await context.close();
})().catch(err => {
  console.error('CAPTURE_FATAL=' + (err?.stack || err));
  process.exit(2);
});
