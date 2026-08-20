#!/usr/bin/env python3
import re
import subprocess
import urllib.request
from bs4 import BeautifulSoup

BASE = 'https://leparfum.com.gr/en/perfumes'
PAGES = [1, 2, 25, 107]
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'


def fetch_urllib(url):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'close',
    })
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            body = r.read()
            return {
                'ok': True,
                'transport': 'urllib',
                'status': r.status,
                'final_url': r.geturl(),
                'ctype': r.headers.get('content-type',''),
                'html': body.decode('utf-8','replace'),
                'error': '',
            }
    except Exception as e:
        return {'ok': False, 'transport': 'urllib', 'status': 0, 'final_url': url, 'ctype': '', 'html': '', 'error': f'{type(e).__name__}: {e}'}


def fetch_curl(url):
    marker = '\n__CURL_META__%{http_code}|%{url_effective}|%{content_type}'
    cmd = [
        'curl', '-L', '--http1.1', '--compressed', '--silent', '--show-error',
        '--connect-timeout', '20', '--max-time', '60',
        '--retry', '2', '--retry-delay', '2', '--retry-all-errors',
        '-A', UA,
        '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '-H', 'Accept-Language: en-US,en;q=0.9',
        '-w', marker,
        url,
    ]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=75)
        if '__CURL_META__' in p.stdout:
            body, meta = p.stdout.rsplit('\n__CURL_META__', 1)
            parts = meta.strip().split('|', 2)
            status = int(parts[0]) if parts and parts[0].isdigit() else 0
            final_url = parts[1] if len(parts) > 1 else url
            ctype = parts[2] if len(parts) > 2 else ''
        else:
            body, status, final_url, ctype = p.stdout, 0, url, ''
        ok = p.returncode == 0 and status > 0
        err = p.stderr.strip()
        return {'ok': ok, 'transport': 'curl', 'status': status, 'final_url': final_url, 'ctype': ctype, 'html': body, 'error': err}
    except Exception as e:
        return {'ok': False, 'transport': 'curl', 'status': 0, 'final_url': url, 'ctype': '', 'html': '', 'error': f'{type(e).__name__}: {e}'}


def analyze(page_no, result):
    html = result['html']
    soup = BeautifulSoup(html, 'html.parser') if html else BeautifulSoup('', 'html.parser')
    cards = soup.select('article.product-miniature[data-id-product]')
    ids = [str(c.get('data-id-product') or '').strip() for c in cards]
    hrefs = [a.get('href','') for a in soup.select('article.product-miniature a[href]')]
    signature_hrefs = [h for h in hrefs if all(x in h.lower() for x in ('choose-', 'bottle-', 'extra_essence-'))]
    challenge = '__browser-challenge' in result['final_url'] or 'browser verification' in html.lower()
    print(f"PAGE={page_no} transport={result['transport']} ok={result['ok']} status={result['status']} final_url={result['final_url']} content_type={result['ctype']!r} bytes={len(html.encode('utf-8'))}")
    if result['error']:
        print(f"PAGE={page_no} transport={result['transport']} error={result['error']!r}")
    print(f"PAGE={page_no} transport={result['transport']} cards={len(cards)} unique_ids={len(set(ids))} signature_hrefs={len(signature_hrefs)}")
    print(f"PAGE={page_no} transport={result['transport']} raw_choose={html.lower().count('choose-')} raw_bottle={html.lower().count('bottle-')} raw_extra={html.lower().count('extra_essence-')} challenge={challenge}")
    if ids:
        print(f"PAGE={page_no} transport={result['transport']} sample_ids={ids[:5]}")
    return len(cards), len(signature_hrefs), result['ok']


def main():
    totals = {'urllib': [0,0,0], 'curl': [0,0,0]}
    for p in PAGES:
        url = BASE if p == 1 else f'{BASE}?page={p}'
        for fetcher in (fetch_urllib, fetch_curl):
            result = fetcher(url)
            cards, signatures, ok = analyze(p, result)
            t = totals[result['transport']]
            t[0] += cards
            t[1] += signatures
            t[2] += int(ok)
    for transport, (cards, sigs, oks) in totals.items():
        print(f'SUMMARY transport={transport} sampled_pages={len(PAGES)} successful_requests={oks} cards={cards} signature_hrefs={sigs}')
    if max(v[0] for v in totals.values()) == 0:
        raise SystemExit('FAIL: GitHub runner could not retrieve any public product cards with either urllib or curl')

if __name__ == '__main__':
    main()
