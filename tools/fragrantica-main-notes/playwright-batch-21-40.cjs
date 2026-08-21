#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const CDP_URL = process.env.SHOBI_CDP_URL || 'http://127.0.0.1:9222';
const OUT_DIR = process.env.SHOBI_CATCHER_OUT || path.join(ROOT, 'tools', 'fragrantica-main-notes', 'results', 'playwright-21-40');
const RANKING = JSON.parse(fs.readFileSync(path.join(ROOT, 'Personal Database', 'bestseller-top40-live.json'), 'utf8'));
const ENRICHMENT = JSON.parse(fs.readFileSync(path.join(ROOT, 'Personal Database', 'site-enrichment-v2.json'), 'utf8'));
const RUNTIME = JSON.parse(fs.readFileSync(path.join(ROOT, 'Personal Database', 'site-runtime-v2.json'), 'utf8'));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const keyOf = code => String(code || '').replace(/\s+/g, '');
const slug = code => String(code).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

const runtimeByCode = new Map((RUNTIME.p || []).map(row => [keyOf(row[0]), row]));

function getTarget(rank) {
  const code = RANKING.codes[rank - 1];
  if (!code) throw new Error(`RANK_${rank}_MISSING`);
  const key = keyOf(code);
  const e = ENRICHMENT.e?.[key];
  const url = Array.isArray(e) ? e[4] : '';
  const row = runtimeByCode.get(key);
  const name = row?.[1] || code;
  const brand = row?.[2] || '';
  return { rank, code, key, name, brand, url };
}

async function findVoteControl(page) {
  const all = page.locator('button,a,[role="button"],span,div');
  const count = await all.count();
  for (let i = 0; i < count; i++) {
    const el = all.nth(i);
    const txt = clean(await el.innerText().catch(() => ''));
    const aria = clean(await el.getAttribute('aria-label').catch(() => ''));
    const title = clean(await el.getAttribute('title').catch(() => ''));
    if (/^(show|hide)\s+votes$/i.test(txt) || /(show|hide)\s+votes/i.test(aria) || /(show|hide)\s+votes/i.test(title)) return el;
  }
  return null;
}

async function waitForVoteControl(page, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const c = await findVoteControl(page);
    if (c) return c;
    await sleep(1000);
  }
  return null;
}

async function collect(page) {
  const control = await waitForVoteControl(page, 30000);
  if (!control) throw new Error('SHOW_VOTES_NOT_FOUND');
  const label = clean(await control.innerText().catch(() => ''));
  if (!/^Hide\s+votes$/i.test(label)) {
    await control.scrollIntoViewIfNeeded().catch(() => {});
    await control.click({ timeout: 10000 });
    await sleep(1200);
  }
  for (let attempt = 1; attempt <= 10; attempt++) {
    const notes = await page.evaluate(() => {
      const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
      const noteId = href => {
        const m = String(href || '').match(/\/notes\/[^/]*?(\d+)(?:\.html)?(?:[?#]|$)/i) || String(href || '').match(/(?:id=)(\d+)/i);
        return m ? Number(m[1]) : null;
      };
      const best = new Map();
      for (const a of document.querySelectorAll('a[href*="/notes/"]')) {
        const raw = clean(a.textContent) || clean(a.querySelector('img[alt]')?.alt) || clean(a.getAttribute('title'));
        if (!raw) continue;
        const m = raw.match(/^\s*([0-9][0-9.,\s]*)\s*([^0-9].*?)\s*$/);
        if (!m) continue;
        const votes = Number(m[1].replace(/[^0-9]/g, ''));
        const note = clean(m[2]);
        if (!Number.isFinite(votes) || votes <= 0 || !note || note.length > 80) continue;
        const id = noteId(a.getAttribute('href'));
        const key = id != null ? `id:${id}` : `name:${note.toLowerCase()}`;
        const prev = best.get(key);
        if (!prev || votes > prev.votes) best.set(key, { note, sastojak_id: id, votes });
      }
      return [...best.values()].sort((a,b) => b.votes-a.votes || a.note.localeCompare(b.note));
    });
    if (notes.length) return notes;
    await sleep(750);
  }
  throw new Error('VOTED_NOTES_NOT_PARSED');
}

async function capture(page, target) {
  if (!/^https:\/\/(www\.)?fragrantica\.com\//i.test(target.url || '')) throw new Error('FRAGRANTICA_URL_MISSING');
  console.log(`\n=== #${target.rank} ${target.code} ${target.name} ===`);
  console.log(target.url);
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1800);
  const ranked = await collect(page);
  const top5 = ranked.slice(0, 5).map((n, i) => ({ rank: i + 1, ...n }));
  const idMatch = target.url.match(/-(\d+)\.html(?:[?#]|$)/i);
  const payload = {
    schema_version: 1,
    source: 'playwright-cdp-real-edge',
    capture_method: ranked.length <= 5 ? 'all-voted-notes-five-or-fewer' : 'show-votes-top5',
    captured_at: new Date().toISOString(),
    rank: target.rank,
    shobi_code: target.code,
    fragrantica_id: idMatch ? Number(idMatch[1]) : null,
    name: target.name,
    brand: target.brand,
    url: target.url,
    total_voted_notes: ranked.length,
    saved_note_count: top5.length,
    notes: top5
  };
  fs.writeFileSync(path.join(OUT_DIR, `${String(target.rank).padStart(3,'0')}-${slug(target.code)}.json`), JSON.stringify(payload, null, 2) + '\n');
  for (const n of top5) console.log(`#${n.rank} ${n.note} votes=${n.votes} sastojak_id=${n.sastojak_id ?? ''}`);
  return payload;
}

async function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const targets = Array.from({ length: 20 }, (_, i) => getTarget(21 + i));
  console.log(`TARGETS ${targets.length}: ${targets.map(x => `#${x.rank} ${x.code}`).join(' | ')}`);

  const missing = targets.filter(t => !/^https:\/\/(www\.)?fragrantica\.com\//i.test(t.url || ''));
  if (missing.length) {
    for (const t of missing) console.error(`MISSING_URL #${t.rank} ${t.code} ${t.name}`);
    throw new Error(`FRAGRANTICA_URLS_MISSING_${missing.length}`);
  }

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 15000 });
  const context = browser.contexts()[0];
  if (!context) throw new Error('CDP_NO_BROWSER_CONTEXT');
  const pages = context.pages();
  const page = pages.find(p => /fragrantica\.com/i.test(p.url())) || pages[0] || await context.newPage();

  const results = [];
  const failures = [];
  for (const target of targets) {
    let ok = false;
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      try {
        const payload = await capture(page, target);
        results.push(payload);
        ok = true;
      } catch (err) {
        console.error(`ATTEMPT_FAIL #${target.rank} attempt=${attempt} ${err.message}`);
        if (attempt < 2) await sleep(5000);
        else failures.push({ rank: target.rank, code: target.code, name: target.name, url: target.url, error: err.message });
      }
    }
    await sleep(2500);
  }

  const summary = { schema_version: 1, captured_at: new Date().toISOString(), range: [21,40], success_count: results.length, failure_count: failures.length, results, failures };
  fs.writeFileSync(path.join(OUT_DIR, 'batch-21-40.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`\nBATCH_SUMMARY success=${results.length} failures=${failures.length}`);
  for (const f of failures) console.error(`FAILED #${f.rank} ${f.code}: ${f.error}`);
  await browser.close().catch(() => {});
  if (failures.length) process.exit(2);
}

main().catch(err => { console.error('BATCH_FATAL', err && err.stack ? err.stack : err); process.exit(1); });
