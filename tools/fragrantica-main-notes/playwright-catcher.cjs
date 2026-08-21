#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const args = new Set(process.argv.slice(2));
const LOGIN_MODE = args.has('--login');
const URL = process.env.FRAGRANTICA_URL || 'https://www.fragrantica.com/perfume/Dior/Sauvage-Elixir-68415.html';
const NAME = process.env.FRAGRANTICA_NAME || 'Sauvage Elixir';
const RANK = Number(process.env.SHOBI_RANK || 21);
const CODE = process.env.SHOBI_CODE || '1644-DRC M';
const PROFILE_DIR = process.env.SHOBI_FRAGRANTICA_PROFILE || path.join(os.homedir(), '.shobi-fragrantica-playwright-profile');
const OUT_DIR = process.env.SHOBI_CATCHER_OUT || path.join(process.cwd(), 'tools', 'fragrantica-main-notes', 'results', 'playwright');
const OUT_FILE = path.join(OUT_DIR, `${String(RANK).padStart(3,'0')}-${CODE.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()}.json`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

async function findVoteControl(page) {
  return page.locator('button,a,[role="button"],span,div').filter({ hasText: /^(Show|Hide)\s+votes$/i }).first();
}

async function collect(page) {
  const control = await findVoteControl(page);
  if (await control.count() === 0) throw new Error('SHOW_VOTES_NOT_FOUND: session may not be logged in, page changed, or Fragrantica blocked the browser');
  const label = clean(await control.innerText().catch(() => ''));
  if (!/^Hide\s+votes$/i.test(label)) {
    await control.scrollIntoViewIfNeeded().catch(() => {});
    await control.click({ timeout: 10000 });
    await sleep(1000);
  }
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
  if (!notes.length) throw new Error('VOTED_NOTES_NOT_PARSED');
  return notes;
}

async function main() {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false, viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
  const pages = context.pages();
  const page = pages[0] || await context.newPage();

  if (LOGIN_MODE) {
    console.log(`LOGIN_PROFILE ${PROFILE_DIR}`);
    console.log('LOGIN_MODE_OPENING Fragrantica. Log in manually in this browser window.');
    console.log('IMPORTANT: after login is complete, CLOSE THE CHROMIUM WINDOW YOURSELF. The persistent profile will be saved.');
    await page.goto('https://www.fragrantica.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => context.on('close', resolve));
    console.log('LOGIN_BROWSER_CLOSED_PROFILE_SAVED');
    return;
  }

  console.log(`PROFILE ${PROFILE_DIR}`);
  console.log(`TARGET rank=${RANK} code=${CODE} name=${NAME}`);
  console.log(`URL ${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1800);
  const ranked = await collect(page);
  const top5 = ranked.slice(0, 5).map((n, i) => ({ rank: i + 1, ...n }));
  const idMatch = URL.match(/-(\d+)\.html(?:[?#]|$)/i);
  const payload = { schema_version: 1, source: 'playwright-persistent-profile', capture_method: ranked.length <= 5 ? 'all-voted-notes-five-or-fewer' : 'show-votes-top5', captured_at: new Date().toISOString(), rank: RANK, shobi_code: CODE, fragrantica_id: idMatch ? Number(idMatch[1]) : null, name: NAME, url: URL, total_voted_notes: ranked.length, saved_note_count: top5.length, notes: top5 };
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`CAPTURE_OK ${OUT_FILE}`);
  for (const n of top5) console.log(`#${n.rank} ${n.note} votes=${n.votes} sastojak_id=${n.sastojak_id ?? ''}`);
  await context.close();
}

main().catch(err => { console.error('CATCHER_FATAL', err && err.stack ? err.stack : err); process.exit(1); });
