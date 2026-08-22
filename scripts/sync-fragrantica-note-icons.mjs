import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE = 'https://www.fragrantica.com/notes/';
const OUT_DIR = 'data/fragrantica-note-icons';
const OUT_JSON = path.join(OUT_DIR, 'registry.json');
const OUT_JS = 'fragrantica-note-icons.js';

function decodeHtml(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

const response = await fetch(SOURCE, {
  headers: {
    'user-agent': 'Mozilla/5.0 ShobiPerfumeDatabase/1.0',
    'accept-language': 'en-US,en;q=0.9'
  }
});
if (!response.ok) throw new Error(`Fragrantica notes fetch failed: HTTP ${response.status}`);
const html = await response.text();

const byName = {};
const byId = {};
const re = /<a[^>]+href=["'](?:https:\/\/www\.fragrantica\.com)?\/notes\/[^"']+-(\d+)\.html["'][^>]*>([\s\S]*?)<\/a>/gi;
let match;
while ((match = re.exec(html))) {
  const id = String(match[1]);
  const name = decodeHtml(match[2]);
  if (!name || !id) continue;
  if (!byName[name]) byName[name] = id;
  if (!byId[id]) byId[id] = name;
}

const count = Object.keys(byName).length;
if (count < 500) throw new Error(`Suspicious Fragrantica note registry size: ${count}`);

const sortedNames = Object.fromEntries(Object.entries(byName).sort((a,b) => a[0].localeCompare(b[0])));
const payload = {
  schema_version: 1,
  source: SOURCE,
  generated_at: new Date().toISOString(),
  count,
  by_name: sortedNames,
  by_id: byId
};

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.writeFile(OUT_JSON, JSON.stringify(payload, null, 2) + '\n');
await fs.writeFile(OUT_JS,
  `// Generated from ${SOURCE}. Do not edit manually.\n` +
  `window.FRAGRANTICA_NOTE_ICON_IDS=${JSON.stringify(sortedNames)};\n` +
  `window.FRAGRANTICA_NOTE_ICON_REGISTRY_META=${JSON.stringify({source:SOURCE,count,generated_at:payload.generated_at})};\n`
);

console.log(`FRAGRANTICA_NOTE_ICONS_OK ${count}`);
