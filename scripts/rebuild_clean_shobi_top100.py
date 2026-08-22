#!/usr/bin/env python3
import csv
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError, Error as PlaywrightError

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'shobi-master-en.csv'
OUT_DIR = ROOT / 'Fragrantica ID Database' / 'rebuild-top100'
OUT = OUT_DIR / 'shobi-top100-clean.json'
BASE_URL = 'https://leparfum.com.gr/en/best-sales?category_rewrite=best-sales&resultsPerPage=36&page={}'

CODE_RE = re.compile(r'^\s*(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-ZΑ-Ω0-9]+))?\b', re.I)
ALIASES = {
    '1685-FRED N': '1685-FRE N',
    '1068-CHA': '1068-CHA M',
    '1930-VIC': '1930-VIC M',
    '1156-HER': '1156-HER M',
    '1065-CHA': '1065-CHA M',
}


def clean(v):
    return re.sub(r'\s+', ' ', str(v or '')).strip()


def norm_code(v):
    v = clean(v).upper().replace('Ν', 'N')
    m = re.match(r'^(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-Z0-9]+))?', v)
    if not m:
        return v
    code = f'{m.group(1)}-{m.group(2)}' + (f' {m.group(3)}' if m.group(3) else '')
    return ALIASES.get(code, code)


def load_master():
    with MASTER.open('r', encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
    by_code = {}
    for row in rows:
        code = norm_code(row.get('shobi_code'))
        if code:
            by_code[code] = row
    if len(by_code) < 2200:
        raise SystemExit(f'Safety stop: filtered Shobi master unexpectedly small ({len(by_code)} codes)')
    return by_code


def open_page(page, page_number):
    url = BASE_URL.format(page_number)
    last_error = None
    for attempt in range(1, 6):
        try:
            page.goto(url, wait_until='commit', timeout=60000)
            try:
                page.wait_for_load_state('domcontentloaded', timeout=30000)
            except PlaywrightTimeoutError:
                pass
            page.wait_for_selector('article.product-miniature', timeout=30000)
            return page.content()
        except (PlaywrightError, PlaywrightTimeoutError) as exc:
            last_error = exc
            print(f'NAV_RETRY page={page_number} attempt={attempt} error={exc}')
            page.wait_for_timeout(2000 * attempt)
    raise SystemExit(f'Safety stop: cannot open Shobi Best sales page {page_number}: {last_error}')


def parse_products(html):
    soup = BeautifulSoup(html, 'html.parser')
    rows = []
    for card in soup.select('article.product-miniature'):
        link = card.select_one('h2.product-title a, .product-title a')
        if not link:
            continue
        title = clean(link.get_text(' ', strip=True))
        m = CODE_RE.search(title)
        raw_code = ''
        if m:
            raw_code = f'{m.group(1)}-{m.group(2)}' + (f' {m.group(3)}' if m.group(3) else '')
        rows.append({
            'code': norm_code(raw_code) if raw_code else '',
            'shobi_title': title,
            'shobi_url': clean(link.get('href')),
        })
    return rows, soup


def main():
    master = load_master()
    selected = []
    seen = set()
    global_rank = 0
    skipped_not_in_master = 0
    pages_scanned = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=['--disable-http2'])
        context = browser.new_context(
            locale='en-US',
            timezone_id='Europe/Athens',
            viewport={'width': 1440, 'height': 1000},
            user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        )
        page = context.new_page()
        page.set_default_timeout(30000)

        page_number = 1
        while len(selected) < 100 and page_number <= 20:
            products, soup = parse_products(open_page(page, page_number))
            pages_scanned += 1
            if not products:
                raise SystemExit(f'Safety stop: zero products parsed on page {page_number}')

            for product in products:
                global_rank += 1
                code = product['code']
                if not code or code not in master:
                    skipped_not_in_master += 1
                    continue
                if code in seen:
                    continue
                seen.add(code)
                mrow = master[code]
                selected.append({
                    'rank': len(selected) + 1,
                    'global_rank': global_rank,
                    'shobi_code': code,
                    'shobi_title': product['shobi_title'],
                    'shobi_url': product['shobi_url'],
                    'master_name': clean(mrow.get('inspired_by') or mrow.get('inspiredBy') or mrow.get('name') or mrow.get('perfume')),
                    'master_brand': clean(mrow.get('brand')),
                })
                if len(selected) == 100:
                    break

            if len(selected) >= 100:
                break
            next_link = soup.select_one('a.next, .pagination .next a, a[rel="next"]')
            if not next_link:
                nums = [int(clean(a.get_text())) for a in soup.select('.pagination a') if clean(a.get_text()).isdigit()]
                if not nums or page_number >= max(nums):
                    break
            page_number += 1
            page.wait_for_timeout(350)

        context.close()
        browser.close()

    if len(selected) != 100:
        raise SystemExit(f'Safety stop: expected 100 filtered Shobi perfumes, got {len(selected)}')
    if [x['rank'] for x in selected] != list(range(1, 101)):
        raise SystemExit('Safety stop: non-contiguous perfume-only ranking')
    if len({x['shobi_code'] for x in selected}) != 100:
        raise SystemExit('Safety stop: duplicate Shobi codes in clean Top100')

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        'schema_version': 1,
        'method': 'Shobi official Best Sales -> filtered against official Shobi Master -> Top100',
        'captured_at': datetime.now(timezone.utc).isoformat(),
        'source': 'https://leparfum.com.gr/en/best-sales',
        'master_source': 'shobi-master-en.csv',
        'count': 100,
        'pages_scanned': pages_scanned,
        'global_products_scanned_until_rank100': global_rank,
        'non_master_products_skipped': skipped_not_in_master,
        'records': selected,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print('CLEAN_SHOBI_TOP100=100')
    print(f'PAGES_SCANNED={pages_scanned}')
    print(f'GLOBAL_PRODUCTS_SCANNED={global_rank}')
    print(f'NON_MASTER_SKIPPED={skipped_not_in_master}')
    print('FIRST_20=' + ','.join(x['shobi_code'] for x in selected[:20]))
    print('LAST_10=' + ','.join(x['shobi_code'] for x in selected[-10:]))
    print(f'OUTPUT={OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
