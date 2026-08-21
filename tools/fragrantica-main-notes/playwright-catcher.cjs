#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.FRAGRANTICA_URL || 'https://www.fragrantica.com/perfume/Dior/Sauvage-Elixir-68415.html';
const NAME = process.env.FRAGRANTICA_NAME || 'Sauvage Elixir';
const RANK = Number(process.env.SHOBI_RANK || 21);
const CODE = process.env.SHOBI_CODE || '1644-DRC M';
const CDP_URL = process.env.SHOBI_CDP_URL || 'http://127.0.0.1:9222';
const OUT_DIR = process.env.SHOBI_CATCHER_OUT || path.join(process.cwd(), 'tools', 'fragrantica-main-notes', 'results', 'playwright');
const OUT_FILE = path.join(OUT_DIR, `${String(RANK).padStart(3,'0')}-${CODE.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()}.json`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

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
    const control = await findVoteControl(page);
    if (control) return control;
    await sleep(1000);
  }
  return null;
}

async function collect(page) {
  const control = await waitForVoteControl(page, 30000);
  if (!control) {
    const title = await page.title().catch(() => '');
    const body = clean(await page.locator('body').innerText().catch(() => '')).slice(0, 500);
    throw new Error(`SHOW_VOTES_NOT_FOUND title=${JSON.stringify(title)} body=${JSON.stringify(body)}`);
  }

  const label = clean(await control.innerText().catch(() => ''));
  if (!/^Hide\s+votes$/i.test(label)) {
    await control.scrollIntoViewIfNeeded().catch(() => {});
    await control.click({ timeout: 10000 });
    await sleep(1200);
  }

  let notes = [];
  for (let attempt = 1; attempt <= 8; attempt++) {
    notes = await page.evaluate(() => {
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
    if (notes.length) break;
    await sleep(750);
  }

  if (!notes.length) throw new Error('VOTED_NOTES_NOT_PARSED');
  return notes;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`CDP_CONNECT ${CDP_URL}`);
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL, { timeout: 15000 });
  } catch (e) {
    throw new Error(`CDP_CONNECT_FAILED: avvia prima start-fragrantica-chrome.cmd. ${e.message}`);
  }

  const contexts = browser.contexts();
  if (!contexts.length) throw new Error('CDP_NO_BROWSER_CONTEXT');
  const context = contexts[0];
  let pages = context.pages();
  const page = pages.find(p => /fragrantica\.com/i.test(p.url())) || pages[0] || await context.newPage();

  console.log(`TARGET rank=${RANK} code=${CODE} name=${NAME}`);
  console.log(`URL ${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1500);

  const ranked = await collect(page);
  const top5 = ranked.slice(0, 5).map((n, i) => ({ rank: i + 1, ...n }));
  const idMatch = URL.match(/-(\d+)\.html(?:[?#]|$)/i);
  const payload = {
    schema_version: 1,
    source: 'playwright-cdp-real-chrome',
    capture_method: ranked.length <= 5 ? 'all-voted-notes-five-or-fewer' : 'show-votes-top5',
    captured_at: new Date().toISOString(),
    rank: RANK,
    shobi_code: CODE,
    fragrantica_id: idMatch ? Number(idMatch[1]) : null,
    name: NAME,
    url: URL,
    total_voted_notes: ranked.length,
    saved_note_count: top5.length,
    notes: top5
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`CAPTURE_OK ${OUT_FILE}`);
  for (const n of top5) console.log(`#${n.rank} ${n.note} votes=${n.votes} sastojak_id=${n.sastojak_id ?? ''}`);
  await browser.close().catch(() => {});
}

main().catch(err => {
  console.error('CATCHER_FATAL', err && err.stack ? err.stack : err);
  process.exit(1);
});
