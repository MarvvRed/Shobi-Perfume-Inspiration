import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const batchPath = path.join(ROOT, 'tools/fragrantica-main-notes/batches/bestsellers-1-10.json');
const outputPath = path.join(ROOT, 'tools/fragrantica-main-notes/results/bestsellers-1-10-auto.json');

const batch = JSON.parse(await fs.readFile(batchPath, 'utf8'));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: 'en-US',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0',
  viewport: { width: 1440, height: 1200 }
});
context.setDefaultTimeout(5000);
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

async function writeCheckpoint() {
  const summary = {
    batch: batch.batch,
    generated_at: new Date().toISOString(),
    total: batch.targets.length,
    processed: results.length,
    captured: results.filter(r => r.status === 'captured').length,
    failed: results.filter(r => r.status === 'failed').length,
    results
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
}

async function captureTarget(target) {
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__shobiDecodedCaptures = [];
    let nativePd;
    let wrappedPd;

    const makeWrapped = fn => function(...args) {
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
          wrappedPd = typeof fn === 'function' ? makeWrapped(fn) : fn;
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
    console.log(`[#${target.rank}] ${target.name}`);
    const response = await page.goto(target.fragrantica_url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    if (response && response.status() >= 400) {
      throw new Error(`HTTP ${response.status()}`);
    }

    await page.waitForTimeout(1200);

    // Bounded scrolling only. Fragrantica can continuously increase scrollHeight
    // while lazy-loading ads/content, so never loop against live scrollHeight.
    await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const maxY = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        window.scrollTo(0, Math.floor(maxY * i / steps));
        await sleep(100);
      }
      window.scrollTo(0, 0);
    });

    const candidates = [
      'text=/perfume pyramid/i',
      '[href*="#notes"]',
      '[href*="notes"]'
    ];
    for (const selector of candidates) {
      try {
        const loc = page.locator(selector).first();
        if (await loc.count()) await loc.click({ timeout: 1000 }).catch(() => {});
      } catch {}
    }

    await page.waitForFunction(
      () => Array.isArray(window.__shobiDecodedCaptures) && window.__shobiDecodedCaptures.length > 0,
      null,
      { timeout: 12000 }
    );

    const decoded = await page.evaluate(() => window.__shobiDecodedCaptures.at(-1));
    const captured = sanitizeCapture(decoded);
    if (!captured) throw new Error('Decoded payload did not contain Main Notes');

    row.status = 'captured';
    row.captured_at = new Date().toISOString();
    row.weights_sum = captured.weights_sum;
    row.notes = captured.notes;
    console.log(`  ✓ ${row.notes.length} notes, weights_sum=${row.weights_sum}`);
  } catch (error) {
    row.status = 'failed';
    row.error = String(error?.message || error);
    console.log(`  ✗ ${row.error}`);
  } finally {
    await page.close().catch(() => {});
  }

  return row;
}

for (const target of batch.targets) {
  const row = await Promise.race([
    captureTarget(target),
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
      error: 'Per-target hard timeout after 55 seconds'
    }), 55000))
  ]);

  results.push(row);
  await writeCheckpoint();
}

await browser.close().catch(() => {});
await writeCheckpoint();

const capturedCount = results.filter(r => r.status === 'captured').length;
console.log(`\nSaved ${outputPath}`);
console.log(`Captured ${capturedCount}/${batch.targets.length}`);
