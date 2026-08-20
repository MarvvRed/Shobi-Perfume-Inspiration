#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.firefox.options import Options

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Shobi Master Database" / "incoming" / "shobi-live-latest.json"
PROFILE = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "ShobiMasterAgent" / "firefox-profile"
PERFUMES_URL = "https://leparfum.com.gr/en/perfumes"
PERFUMES_XHR = "/en/perfumes?resultsPerPage=99999&order=product.sales.desc&from-xhr="
SHOBI_XHR = "/el/shobi?resultsPerPage=99999&order=product.sales.desc&from-xhr="

JS_FETCH = r"""
const path = arguments[0], mode = arguments[1], done = arguments[arguments.length - 1];
fetch(path, {
  headers: {'Accept':'application/json, text/javascript, */*; q=0.01','X-Requested-With':'XMLHttpRequest'},
  credentials:'same-origin'
}).then(async r => {
  const text = await r.text();
  if (!r.ok) throw new Error('HTTP '+r.status);
  const data = JSON.parse(text);
  const html = data.rendered_products || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const cards = [...doc.querySelectorAll('article.product-miniature[data-id-product]')];
  if (mode === 'category') {
    done({ok:true, total_cards:cards.length, ids:[...new Set(cards.map(c => String(c.dataset.idProduct || '').trim()).filter(Boolean))]});
    return;
  }
  const rows = [];
  for (const c of cards) {
    const hrefs = [...c.querySelectorAll('a[href]')].map(a => a.href || a.getAttribute('href') || '');
    const sig = hrefs.find(h => { const x=h.toLowerCase(); return x.includes('choose-') && x.includes('bottle-') && x.includes('extra_essence-'); });
    if (!sig) continue;
    const txt = sel => { const n=c.querySelector(sel); return n ? n.textContent.replace(/\s+/g,' ').trim() : ''; };
    rows.push({
      prestashop_product_id:String(c.dataset.idProduct || '').trim(),
      shobi_name:txt('.product-title'),
      reference:txt('.product-reference'),
      category:txt('.product-category-name'),
      official_description:txt('.product-description-short'),
      price_text:txt('.product-price'),
      signature_href:sig
    });
  }
  done({ok:true, total_cards:cards.length, rows:rows});
}).catch(e => done({ok:false, error:String(e && e.stack || e)}));
"""


def run(cmd):
    print('+', ' '.join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def capture(setup=False):
    PROFILE.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)

    opts = Options()
    opts.add_argument('-profile')
    opts.add_argument(str(PROFILE))
    driver = webdriver.Firefox(options=opts)
    driver.set_script_timeout(180)
    try:
        driver.get(PERFUMES_URL)
        if setup:
            print('SETUP: complete any browser verification in Firefox, then return here and press ENTER.')
            input()
        else:
            time.sleep(8)

        perfumes = driver.execute_async_script(JS_FETCH, PERFUMES_XHR, 'perfumes')
        if not perfumes or not perfumes.get('ok'):
            raise RuntimeError(f"Perfumes XHR failed: {perfumes}")
        category = driver.execute_async_script(JS_FETCH, SHOBI_XHR, 'category')
        if not category or not category.get('ok'):
            raise RuntimeError(f"Shobi category XHR failed: {category}")

        rows = perfumes['rows']
        ids = [r['prestashop_product_id'] for r in rows]
        category_ids = category['ids']
        if len(rows) < 2200 or perfumes['total_cards'] < 2400:
            raise RuntimeError(f"Safety stop: suspicious perfumes counts total={perfumes['total_cards']} shobi={len(rows)}")
        if len(ids) != len(set(ids)):
            raise RuntimeError('Safety stop: duplicate Shobi prestashop_product_id')
        if len(category_ids) < 3000 or len(category_ids) != len(set(category_ids)):
            raise RuntimeError(f"Safety stop: suspicious /el/shobi IDs count={len(category_ids)}")
        missing = sorted(set(ids) - set(category_ids), key=lambda x: int(x) if x.isdigit() else x)
        if missing:
            raise RuntimeError(f"Safety stop: {len(missing)} Shobi perfume IDs absent from /el/shobi; sample={missing[:20]}")

        payload = {
            'captured_at_utc': datetime.now(timezone.utc).isoformat(),
            'capture_host': os.environ.get('COMPUTERNAME','windows-local-agent'),
            'source_url': PERFUMES_XHR,
            'secondary_source_url': SHOBI_XHR,
            'classification_rule': 'Choose+Bottle+Extra Essence',
            'secondary_validation_rule': 'prestashop_product_id present in /el/shobi',
            'total_perfumes_cards': perfumes['total_cards'],
            'shobi_perfumes': len(rows),
            'shobi_category_products': len(category_ids),
            'shobi_category_extra_products': len(set(category_ids)-set(ids)),
            'shobi_category_missing_perfumes': 0,
            'rows': rows,
            'shobi_category_ids': category_ids,
        }
        OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"CAPTURE_OK file={OUT} total={perfumes['total_cards']} shobi={len(rows)} category={len(category_ids)} extra={payload['shobi_category_extra_products']}")
    finally:
        driver.quit()


def push_snapshot():
    run(['git','pull','--ff-only'])
    run(['git','add',str(OUT.relative_to(ROOT))])
    status = subprocess.run(['git','diff','--cached','--quiet'], cwd=ROOT)
    if status.returncode == 0:
        print('No incoming snapshot change to push.')
        return
    stamp = datetime.now().strftime('%Y-%m-%d %H:%M')
    run(['git','commit','-m',f'Capture Shobi live snapshot {stamp}'])
    run(['git','push'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--setup', action='store_true', help='First run: allow manual browser verification before capture')
    ap.add_argument('--push', action='store_true', help='Commit and push the validated incoming snapshot')
    args = ap.parse_args()
    capture(setup=args.setup)
    if args.push:
        push_snapshot()

if __name__ == '__main__':
    main()
