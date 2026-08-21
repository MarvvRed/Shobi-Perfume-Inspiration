#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const enrichmentPath = path.join(ROOT, 'Personal Database', 'site-enrichment-v2.json');
const data = JSON.parse(fs.readFileSync(enrichmentPath, 'utf8'));
if (!data.e || typeof data.e !== 'object') data.e = {};

const overrides = {
  '1644-DRCM': 'https://www.fragrantica.com/perfume/Dior/Sauvage-Elixir-68415.html',
  '2398-FRELUX': 'https://www.fragrantica.com/perfume/Frederic-Malle/Acne-Studios-91209.html',
  '401-ARIAWP': 'https://www.fragrantica.com/perfume/Ariana-Grande/Cloud-50384.html',
  '1660-ESCEEL': 'https://www.fragrantica.com/perfume/Escentric-Molecules/Molecule-01-845.html',
  '1067-CHAM': 'https://www.fragrantica.com/perfume/Chanel/Bleu-de-Chanel-9099.html',
  '485-CARWP': 'https://www.fragrantica.com/perfume/Carolina-Herrera/Good-Girl-39681.html',
  '1499-BYREL': 'https://www.fragrantica.com/perfume/Byredo/Mojave-Ghost-27040.html',
  '1735-XERN': 'https://www.fragrantica.com/perfume/Xerjoff/Italica-2021-65383.html',
  '1520-YZLOW': 'https://www.fragrantica.com/perfume/Yves-Saint-Laurent/Libre-Intense-62318.html',
  '152-PARFN': 'https://www.fragrantica.com/perfume/Parfums-de-Marly/Delina-Exclusif-50370.html',
  '132-LTNN': 'https://www.fragrantica.com/perfume/Louis-Vuitton/Ombre-Nomade-49755.html',
  '1498-BYREL': 'https://www.fragrantica.com/perfume/Byredo/Gypsy-Water-3575.html',
  '1764-GURW': 'https://www.fragrantica.com/perfume/Guerlain/Aqua-Allegoria-Coconut-Fizz-53806.html',
  '1919-PRAWP': 'https://www.fragrantica.com/perfume/Prada/Prada-Paradoxe-75668.html',
  '131-LELN': 'https://www.fragrantica.com/perfume/Le-Labo/Santal-33-12201.html',
  '2348-AMG': 'https://www.fragrantica.com/perfume/Amouage/Guidance-78656.html',
  '303-JOMEL': 'https://www.fragrantica.com/perfume/Jo-Malone-London/Wood-Sage-Sea-Salt-25529.html'
};

let changed = 0;
for (const [key, url] of Object.entries(overrides)) {
  let row = data.e[key];
  if (!Array.isArray(row)) row = [];
  while (row.length < 5) row.push('');
  if (row[4] !== url) changed++;
  row[4] = url;
  data.e[key] = row;
  console.log(`OVERRIDE ${key} -> ${url}`);
}

fs.writeFileSync(enrichmentPath, JSON.stringify(data));
console.log(`URL_OVERRIDE_SUMMARY total=${Object.keys(overrides).length} changed=${changed}`);
