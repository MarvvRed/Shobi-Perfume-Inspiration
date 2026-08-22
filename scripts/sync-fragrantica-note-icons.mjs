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

const runtime = `// Generated from ${SOURCE}. Do not edit manually.\n` +
`window.FRAGRANTICA_NOTE_ICON_IDS=${JSON.stringify(sortedNames)};\n` +
`window.FRAGRANTICA_NOTE_ICON_REGISTRY_META=${JSON.stringify({source:SOURCE,count,generated_at:payload.generated_at})};\n` +
`(function(){\n` +
`  const ids=window.FRAGRANTICA_NOTE_ICON_IDS||{};\n` +
`  const norm=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');\n` +
`  const normalized=Object.fromEntries(Object.entries(ids).map(([name,id])=>[norm(name),id]));\n` +
`  function fix(root=document){\n` +
`    root.querySelectorAll('[data-card-filter="note"]').forEach(btn=>{\n` +
`      const name=String(btn.dataset.filterValue||'').trim();\n` +
`      const id=ids[name]||normalized[norm(name)];\n` +
`      if(!id)return;\n` +
`      const current=btn.querySelector('img');\n` +
`      if(current){current.src='https://fimgs.net/mdimg/sastojci/t.'+id+'.jpg';return;}\n` +
`      const placeholder=btn.querySelector('span[aria-hidden="true"]');\n` +
`      const img=document.createElement('img');\n` +
`      img.src='https://fimgs.net/mdimg/sastojci/t.'+id+'.jpg';img.alt='';img.width=22;img.height=22;img.loading='lazy';img.decoding='async';\n` +
`      img.style.cssText='width:22px;height:22px;object-fit:cover;border-radius:50%;flex:0 0 22px';\n` +
`      if(placeholder)placeholder.replaceWith(img);else btn.insertBefore(img,btn.firstChild);\n` +
`    });\n` +
`  }\n` +
`  document.addEventListener('DOMContentLoaded',()=>{fix();const c=document.getElementById('resultsContainer');if(c)new MutationObserver(()=>fix(c)).observe(c,{childList:true,subtree:true});});\n` +
`})();\n`;

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.writeFile(OUT_JSON, JSON.stringify(payload, null, 2) + '\n');
await fs.writeFile(OUT_JS, runtime);

console.log(`FRAGRANTICA_NOTE_ICONS_OK ${count}`);
