#!/usr/bin/env python3
import re
import urllib.request
from bs4 import BeautifulSoup

BASE = 'https://leparfum.com.gr/en/perfumes'
PAGES = [1, 2, 25, 107]
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36'


def fetch(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    })
    with urllib.request.urlopen(req, timeout=45) as r:
        body = r.read()
        return r.status, r.geturl(), r.headers.get('content-type',''), body.decode('utf-8','replace')


def inspect(page_no):
    url = BASE if page_no == 1 else f'{BASE}?page={page_no}'
    status, final_url, ctype, html = fetch(url)
    soup = BeautifulSoup(html, 'html.parser')
    cards = soup.select('article.product-miniature[data-id-product]')
    ids = [str(c.get('data-id-product') or '').strip() for c in cards]
    hrefs = [a.get('href','') for a in soup.select('article.product-miniature a[href]')]
    signature_hrefs = [h for h in hrefs if all(x in h.lower() for x in ('choose-', 'bottle-', 'extra_essence-'))]
    print(f'PAGE={page_no} status={status} final_url={final_url} content_type={ctype!r} bytes={len(html.encode("utf-8"))}')
    print(f'PAGE={page_no} cards={len(cards)} unique_ids={len(set(ids))} signature_hrefs={len(signature_hrefs)}')
    print(f'PAGE={page_no} raw_choose={html.lower().count("choose-")} raw_bottle={html.lower().count("bottle-")} raw_extra={html.lower().count("extra_essence-")}')
    print(f'PAGE={page_no} challenge={"__browser-challenge" in final_url or "browser verification" in html.lower()}')
    if ids:
        print(f'PAGE={page_no} sample_ids={ids[:5]}')
    return len(cards), len(signature_hrefs)


def main():
    total_cards = 0
    total_signatures = 0
    for p in PAGES:
        cards, signatures = inspect(p)
        total_cards += cards
        total_signatures += signatures
    print(f'SUMMARY sampled_pages={len(PAGES)} cards={total_cards} signature_hrefs={total_signatures}')
    if total_cards == 0:
        raise SystemExit('FAIL: no public product cards accessible')

if __name__ == '__main__':
    main()
