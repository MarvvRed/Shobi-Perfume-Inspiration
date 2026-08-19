import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, m => m.slice(1)));
const ROOT = path.resolve(HERE, '../../..');
const batchPath = path.join(ROOT, 'tools/fragrantica-main-notes/batches/bestsellers-1-10.json');
const outDir = path.join(HERE, 'results');
const outputPath = path.join(outDir, 'bestsellers-1-10.json');

const batch = JSON.parse(await fs.readFile(batchPath, 'utf8'));
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'msedge',
  headless: false,
  args: [
    '--start-maximized',
    '--disable-blink-features=AutomationControlled'
  ]
});

const context = await browser.newContext({
  locale: 'en-US',
  viewport: null,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
});
context.setDefaultTimeout(6000);
context.setDefaultNavigationTimeout(30000);

const results = [];

function sanitizeCapture(decoded) {
  if (!decoded?.notes?.length || !decoded?.weights_sum) return null;
  const levelFor = id => {
    if (decoded.pyramid?.top?.some(n => n.sastojak_id === id)) return 'top';
    if (decoded.pyramid?.middle?.some(n => n.sastojak_id === id)) return 'middle';
    if (decoded.pyramid?.base?.some(n => n.sastojak_id === id)) return 'base';
    return null;
  };
  return {
    weights_sum: decoded.weights_sum,
    notes: decoded.notes.map((n, i) => ({
      rank: i + 1,
      note: n.pyramid_title || n.engleski || n.note_title,
      note_title: n.note_title || null,
      engleski: n.engleski || null,
      pyramid_title: n.pyramid_title || null,
      sastojak_id: n.sastojak_id,
      weight: n.weight,
      percentage: +(n.weight / decoded.weights_sum * 100).toFixed(2),
      pyramid_level: levelFor(n.sastojak_id)
    }))
  };
}

async function checkpoint() {
  const summary = {
    batch: batch.batch,
    generated_at: new Date().toISOString(),
    total: batch.targets.length,
    processed: results.length,
    captured: results.filter(r => r.status === 'captured').length,
    failed: results.filter(r => r.status === 'failed').length,
    results
  };
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
}

async function captureOne(target) {
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__shobiDecodedCaptures = [];
    let nativePd;
    let wrappedPd;

    const wrap = fn => function(...args) {
      const result = fn.apply(this, args);
      Promise.resolve(result).then(decoded => {
        try {
          if (decoded?.notes?.length && decoded?.weights_sum) {
            window.__shobiDecodedCaptures.push(decoded);
          }
        } catch {}
      });
      return result;
    };

    try {
      Object.defineProperty(window, '_pd', {
        configurable: true,
        enumerable: true,
        get() { return wrappedPd || nativePd; },
        set(fn) {
          nativePd = fn;
          wrappedPd = typeof fn === 'function' ? wrap(fn) : fn;
        }
      });
    } catch {}
  });

  const row = {
    rank: target.rank,
    name: target.name,
    brand: target.brand,
    fragrantica_id: target.fragrantica_id,
    url: target.fragrantica_url,
    status: 'pending',
    captured_at: null,
    weights_sum: null,
    notes: [],
    error: null
  };

  try {
    console.log(`[#${target.rank}/10] ${target.name}`);
    const response = await page.goto(target.fragrantica_url, { waitUntil: 'domcontentloaded' });
    if (response && response.status() >= 400) throw new Error(`HTTP ${response.status()}`);

    await page.waitForTimeout(1000);

    await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const h = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
      for (const f of [0.20, 0.40, 0.60, 0.80, 1.0]) {
        window.scrollTo(0, Math.floor(h * f));
        await sleep(180);
      }
      window.scrollTo(0, Math.floor(h * 0.45));
    });

    for (const selector of ['text=/perfume pyramid/i', '[href*="#notes"]', '[href*="notes"]']) {
      try {
        const loc = page.locator(selector).first();
        if (await loc.count()) await loc.click({ timeout: 900 }).catch(() => {});
      } catch {}
    }

    await page.waitForFunction(
      () => Array.isArray(window.__shobiDecodedCaptures) && window.__shobiDecodedCaptures.length > 0,
      null,
      { timeout: 12000 }
    );

    const decoded = await page.evaluate(() => window.__shobiDecodedCaptures.at(-1));
    const clean = sanitizeCapture(decoded);
    if (!clean) throw new Error('Main Notes payload non trovato');

    row.status = 'captured';
    row.captured_at = new Date().toISOString();
    row.weights_sum = clean.weights_sum;
    row.notes = clean.notes;
    console.log(`   OK: ${row.notes.length} note`);
  } catch (e) {
    row.status = 'failed';
    row.error = String(e?.message || e);
    console.log(`   FAIL: ${row.error}`);
  } finally {
    await page.close().catch(() => {});
  }

  return row;
}

for (const target of batch.targets) {
  const result = await Promise.race([
    captureOne(target),
    new Promise(resolve => setTimeout(() => resolve({
      rank: target.rank,
      name: target.name,
      brand: target.brand,
      fragrantica_id: target.fragrantica_id,
      url: target.fragrantica_url,
      status: 'failed',
      captured_at: null,
      weights_sum: null,
      notes: [],
      error: 'Timeout locale 35s'
    }), 35000))
  ]);
  results.push(result);
  await checkpoint();
  await new Promise(r => setTimeout(r, 700));
}

await browser.close().catch(() => {});
await checkpoint();

const ok = results.filter(r => r.status === 'captured').length;
console.log(`\nFINE: ${ok}/${batch.targets.length} catturati`);
console.log(`JSON: ${outputPath}`);
process.exitCode = ok === 0 ? 2 : 0;
