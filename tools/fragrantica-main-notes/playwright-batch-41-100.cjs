#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const CDP_URL = process.env.SHOBI_CDP_URL || 'http://127.0.0.1:9222';
const OUT_DIR = process.env.SHOBI_CATCHER_OUT || path.join(ROOT, 'tools', 'fragrantica-main-notes', 'results', 'playwright-41-100');
const SHOBI_BESTSELLER_URL = 'https://leparfum.com.gr/en/perfumes?resultsPerPage=99999&order=product.sales.desc&from-xhr=';
const readJson = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const ENRICHMENT = readJson('Personal Database/site-enrichment-v2.json');
const RUNTIME = readJson('Personal Database/site-runtime-v2.json');

const EXTRA_SOURCES = [
  'Personal Database/site-details-v2.json',
  'Personal Database/perfume-details.json',
  'Personal Database/perfume-metadata.json',
  'Personal Database/shobi-catalog.json'
].map(rel => {
  try { return { rel, data: readJson(rel) }; }
  catch (e) { console.warn(`SOURCE_SKIP ${rel}: ${e.message}`); return null; }
}).filter(Boolean);

const SOURCE_LOCK_FILES = [
  'Shobi Master Database/bestseller-top100-source-lock.csv',
  'Shobi Master Database/bestseller-top100-source-lock-pass2.csv'
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const keyOf = code => String(code || '').replace(/\s+/g, '').toUpperCase();
const urlCodeSlug = code => String(code || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const slug = code => String(code).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
const isFragUrl = s => /^https:\/\/(www\.)?fragrantica\.(com|it)\//i.test(String(s || ''));
const runtimeRows = (RUNTIME.p || []).filter(Array.isArray);
const runtimeByCode = new Map(runtimeRows.map(row => [keyOf(row[0]), row]));
const runtimeByUrlSlug = new Map();
for (const row of runtimeRows) {
  const s = urlCodeSlug(row[0]);
  if (s && !runtimeByUrlSlug.has(s)) runtimeByUrlSlug.set(s, row);
}

function findFragUrlDeep(node, targetKey, depth = 0) {
  if (depth > 12 || node == null) return '';
  if (typeof node === 'string') return isFragUrl(node) ? node : '';
  if (Array.isArray(node)) {
    const containsCode = node.some(v => typeof v === 'string' && keyOf(v) === targetKey);
    if (containsCode) {
      for (const v of node) {
        const u = findFragUrlDeep(v, targetKey, depth + 1);
        if (u) return u;
      }
    }
    for (const v of node) {
      if (v && typeof v === 'object') {
        const u = findFragUrlDeep(v, targetKey, depth + 1);
        if (u) return u;
      }
    }
    return '';
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (keyOf(k) === targetKey) {
        const u = findFragUrlDeep(v, targetKey, depth + 1);
        if (u) return u;
      }
    }
  }
  return '';
}

function resolveFromTextFile(rel, code) {
  try {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const key = keyOf(code);
    for (const line of text.split(/\r?\n/)) {
      if (!keyOf(line).includes(key)) continue;
      const m = line.match(/https:\/\/(?:www\.)?fragrantica\.(?:com|it)\/[^,\"\s]+/i);
      if (m) return m[0];
    }
  } catch {}
  return '';
}

function resolveUrl(code) {
  const key = keyOf(code);
  const direct = ENRICHMENT.e?.[key];
  if (Array.isArray(direct)) {
    const u = direct.find(isFragUrl);
    if (u) return { url: u, source: 'site-enrichment-v2.direct' };
  }
  const u0 = findFragUrlDeep(ENRICHMENT, key);
  if (u0) return { url: u0, source: 'site-enrichment-v2.deep' };
  for (const src of EXTRA_SOURCES) {
    const u = findFragUrlDeep(src.data, key);
    if (u) return { url: u, source: src.rel };
  }
  for (const rel of SOURCE_LOCK_FILES) {
    const u = resolveFromTextFile(rel, code);
    if (u) return { url: u, source: rel };
  }
  const masterUrl = resolveFromTextFile('Shobi Master Database/shobi-master-current.csv', code);
  if (masterUrl) return { url: masterUrl, source: 'master-current' };
  return { url: '', source: '' };
}

function matchRuntimeFromHref(href) {
  const lower = String(href || '').toLowerCase();
  for (const [s, row] of runtimeByUrlSlug) {
    if (lower.includes('/' + s) || lower.includes(s + '?') || lower.endsWith(s)) return row;
  }
  return null;
}

async function extractLiveTop100(page) {
  console.log(`SHOBI_RANKING_URL ${SHOBI_BESTSELLER_URL}`);
  await page.goto(SHOBI_BESTSELLER_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(5000);

  const hrefs = await page.evaluate(() => {
    const out = [];
    const push = href => {
      href = String(href || '').trim();
      if (!href || !/^https?:/i.test(href)) return;
      if (!/leparfum\.com\.gr\//i.test(href)) return;
      if (!/\/\d{1,4}-[a-z0-9-]+/i.test(href)) return;
      out.push(href);
    };
    const cards = document.querySelectorAll('.product-miniature, .js-product-miniature, article.product, article');
    for (const card of cards) {
      const links = card.querySelectorAll('a[href]');
      for (const a of links) {
        const href = a.href;
        if (/\/\d{1,4}-[a-z0-9-]+/i.test(href || '')) { push(href); break; }
      }
    }
    if (out.length < 100) {
      for (const a of document.querySelectorAll('a[href]')) push(a.href);
    }
    return out;
  });

  const seen = new Set();
  const rows = [];
  for (const href of hrefs) {
    const row = matchRuntimeFromHref(href);
    if (!row) continue;
    const k = keyOf(row[0]);
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push(row);
    if (rows.length >= 100) break;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'shobi-live-hrefs.json'), JSON.stringify(hrefs.slice(0, 500), null, 2) + '\n');
  fs.writeFileSync(path.join(OUT_DIR, 'bestseller-top100-live.json'), JSON.stringify({ captured_at:new Date().toISOString(), count:rows.length, codes:rows.map(r=>r[0]) }, null, 2) + '\n');
  console.log(`LIVE_MATCHED ${rows.length}`);
  if (rows.length < 100) throw new Error(`LIVE_TOP100_INCOMPLETE_${rows.length}`);
  console.log(`LIVE_TOP100 ${rows.slice(0,100).map((r,i)=>`#${i+1} ${r[0]}`).join(' | ')}`);
  return rows.slice(0,100);
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
  console.log(`\n=== #${target.rank} ${target.code} ${target.name} ===`);
  console.log(`URL ${target.url}`);
  console.log(`URL_SOURCE ${target.url_source}`);
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1800);
  const ranked = await collect(page);
  const top5 = ranked.slice(0, 5).map((n, i) => ({ rank: i + 1, ...n }));
  const idMatch = target.url.match(/-(\d+)\.html(?:[?#]|$)/i);
  const payload = { schema_version:1, source:'playwright-cdp-real-edge', capture_method: ranked.length <= 5 ? 'all-voted-notes-five-or-fewer' : 'show-votes-top5', captured_at:new Date().toISOString(), rank:target.rank, shobi_code:target.code, fragrantica_id:idMatch?Number(idMatch[1]):null, name:target.name, brand:target.brand, url:target.url, url_source:target.url_source, total_voted_notes:ranked.length, saved_note_count:top5.length, notes:top5 };
  fs.writeFileSync(path.join(OUT_DIR, `${String(target.rank).padStart(3,'0')}-${slug(target.code)}.json`), JSON.stringify(payload,null,2)+'\n');
  for (const n of top5) console.log(`#${n.rank} ${n.note} votes=${n.votes} sastojak_id=${n.sastojak_id ?? ''}`);
  return payload;
}

async function main() {
  fs.rmSync(OUT_DIR,{recursive:true,force:true});
  fs.mkdirSync(OUT_DIR,{recursive:true});

  const browser = await chromium.connectOverCDP(CDP_URL,{timeout:15000});
  const context = browser.contexts()[0];
  if (!context) throw new Error('CDP_NO_BROWSER_CONTEXT');
  const pages = context.pages();
  const page = pages[0] || await context.newPage();

  const liveTop100 = await extractLiveTop100(page);
  const targets = liveTop100.slice(40,100).map((row,i)=>{
    const code=row[0];
    const resolved=resolveUrl(code);
    return {rank:41+i,code,name:row[1]||code,brand:row[2]||'',url:resolved.url,url_source:resolved.source};
  });
  fs.writeFileSync(path.join(OUT_DIR,'canonical-targets-41-100.json'),JSON.stringify(targets,null,2)+'\n');
  console.log(`TARGETS ${targets.length}: ${targets.map(x=>`#${x.rank} ${x.code}`).join(' | ')}`);
  for(const t of targets) console.log(`RESOLVE #${t.rank} ${t.code}: ${t.url || 'MISSING'} ${t.url_source || ''}`);

  const missing=targets.filter(t=>!isFragUrl(t.url));
  fs.writeFileSync(path.join(OUT_DIR,'missing-fragrantica-urls.json'),JSON.stringify(missing,null,2)+'\n');
  if(missing.length){
    for(const t of missing) console.error(`MISSING_URL #${t.rank} ${t.code} ${t.name}`);
    throw new Error(`FRAGRANTICA_URLS_MISSING_${missing.length}`);
  }

  const results=[], failures=[];
  for(const target of targets){
    let ok=false;
    for(let attempt=1;attempt<=2&&!ok;attempt++){
      try{results.push(await capture(page,target));ok=true;}
      catch(err){console.error(`ATTEMPT_FAIL #${target.rank} attempt=${attempt} ${err.message}`);if(attempt<2)await sleep(5000);else failures.push({rank:target.rank,code:target.code,name:target.name,url:target.url,error:err.message});}
    }
    await sleep(2500);
  }

  const summary={schema_version:1,captured_at:new Date().toISOString(),range:[41,100],success_count:results.length,failure_count:failures.length,results,failures};
  fs.writeFileSync(path.join(OUT_DIR,'batch-41-100.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(`\nBATCH_SUMMARY success=${results.length} failures=${failures.length}`);
  for(const f of failures) console.error(`FAILED #${f.rank} ${f.code}: ${f.error}`);
  await browser.close().catch(()=>{});
  if(failures.length)process.exit(2);
}

main().catch(err=>{console.error('BATCH_FATAL',err&&err.stack?err.stack:err);process.exit(1);});
