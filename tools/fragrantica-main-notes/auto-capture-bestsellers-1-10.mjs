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

for (const target of batch.targets) {
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
        get() {
          return wrappedPd || nativePd;
        },
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
      timeout: 45000
    });

    if (response && response.status() >= 400) {
      throw new Error(`HTTP ${response.status()}`);
    }

    await page.waitForTimeout(1500);
    await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      for (let y = 0; y <= document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await sleep(120);
      }
      window.scrollTo(0, 0);
    });

    const candidates = [
      'text=/notes/i',
      'text=/perfume pyramid/i',
      '[href*="#notes"]',
      '[href*="notes"]'
    ];
    for (const selector of candidates) {
      try {
        const loc = page.locator(selector).first();
        if (await loc.count()) await loc.click({ timeout: 1200 }).catch(() => {});
      } catch {}
    }

    await page.waitForFunction(
      () => Array.isArray(window.__shobiDecodedCaptures) && window.__shobiDecodedCaptures.length > 0,
      null,
      { timeout: 20000 }
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
    results.push(row);
    await page.close();
  }
}

await browser.close();

const summary = {
  batch: batch.batch,
  generated_at: new Date().toISOString(),
  total: results.length,
  captured: results.filter(r => r.status === 'captured').length,
  failed: results.filter(r => r.status === 'failed').length,
  results
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(`\nSaved ${outputPath}`);
console.log(`Captured ${summary.captured}/${summary.total}`);

// Deliberately exit successfully even with partial failures so the workflow can
// commit the diagnostic result JSON. The result file carries per-target status.
// Trigger marker: 2026-08-19 automatic batch run.
