#!/usr/bin/env python3
import csv
import json
import re
import time
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError, Error as PlaywrightError

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "shobi-master-en.csv"
OUTPUT = ROOT / "bestseller-ranking.js"
BASE_URL = "https://leparfum.com.gr/en/best-sales?category_rewrite=best-sales&resultsPerPage=36&page={}"

EXPECTED_FIRST_20 = [
    "305-KAY EL","1508-KIL WP","451-BYR WP","374-TMFO EL","1899-ZARK EL",
    "111-BAC N","220-CRD EL","350-TMFO EL","2216-DOL WP","2129-SOL EL",
    "371-TMFO EL","449-BYR WP","204-CRD EL","765-KIL WP","994-ZAD WP",
    "2371-MATIE EL","2206-GIA LUX","179-XER N","229-DIP EL","2162-BRB WP",
]

CODE_RE = re.compile(r"^\s*(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-ZΑ-Ω0-9]+))?\b", re.I)
ALIASES = {
    "1685-FRED N": "1685-FRE N",
    "1068-CHA": "1068-CHA M",
    "1930-VIC": "1930-VIC M",
    "1156-HER": "1156-HER M",
    "1065-CHA": "1065-CHA M",
}

def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()

def norm_code(v):
    v = clean(v).upper().replace("Ν", "N")
    m = re.match(r"^(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-Z0-9]+))?", v)
    if not m:
        return v
    code = f"{m.group(1)}-{m.group(2)}" + (f" {m.group(3)}" if m.group(3) else "")
    return ALIASES.get(code, code)

def load_master_codes():
    with MASTER.open("r", encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    codes = {norm_code(r.get("shobi_code")) for r in rows if r.get("shobi_code")}
    if len(codes) < 2200:
        raise SystemExit(f"Safety stop: master unexpectedly small ({len(codes)} codes)")
    return codes

def open_best_sales(page, page_number):
    url = BASE_URL.format(page_number)
    last_error = None
    for attempt in range(1, 5):
        try:
            page.goto(url, wait_until="commit", timeout=60000)
            try:
                page.wait_for_load_state("domcontentloaded", timeout=30000)
            except PlaywrightTimeoutError:
                pass
            last_error = None
            break
        except PlaywrightError as exc:
            last_error = exc
            print(f"BEST_SALES_NAV_RETRY page={page_number} attempt={attempt} error={exc}")
            page.wait_for_timeout(1500 * attempt)
    if last_error is not None:
        raise SystemExit(f"Safety stop: Playwright could not open Best sales page {page_number} after retries: {last_error}")

    deadline = time.time() + 30
    while "/browser-challenge" in page.url and time.time() < deadline:
        page.wait_for_timeout(1000)

    if "/en/best-sales" not in page.url:
        raise SystemExit(f"Safety stop: Playwright Best sales did not reach expected page: {page.url}")

    try:
        page.wait_for_selector("article.product-miniature", timeout=30000)
    except PlaywrightTimeoutError:
        raise SystemExit(f"Safety stop: no Best sales product cards rendered on page {page_number}: {page.url}")

    return page.content()

def parse_page(html):
    soup = BeautifulSoup(html, "html.parser")
    products = []
    for card in soup.select("article.product-miniature"):
        title = card.select_one("h2.product-title a, .product-title a")
        if not title:
            continue
        text = clean(title.get_text(" ", strip=True))
        m = CODE_RE.search(text)
        code = ""
        if m:
            raw = f"{m.group(1)}-{m.group(2)}" + (f" {m.group(3)}" if m.group(3) else "")
            code = norm_code(raw)
        products.append({"code": code, "title": text})
    return products, soup

def main():
    master_codes = load_master_codes()
    filtered = []
    seen_codes = set()
    global_rank = 0
    skipped_non_perfume = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--disable-http2"])
        context = browser.new_context(
            locale="en-US",
            timezone_id="Europe/Athens",
            viewport={"width": 1440, "height": 1000},
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()
        page.set_default_timeout(30000)

        page_number = 1
        while page_number <= 150:
            products, soup = parse_page(open_best_sales(page, page_number))
            if not products:
                if page_number == 1:
                    raise SystemExit("Safety stop: no products parsed from Shobi Best sales")
                break

            for product in products:
                global_rank += 1
                code = product["code"]
                if not code or code not in master_codes:
                    skipped_non_perfume += 1
                    continue
                if code in seen_codes:
                    continue
                seen_codes.add(code)
                filtered.append({"rank": len(filtered) + 1, "globalRank": global_rank, "code": code})

            next_link = soup.select_one("a.next, .pagination .next a, a[rel='next']")
            if not next_link:
                nums = [int(clean(a.get_text())) for a in soup.select(".pagination a") if clean(a.get_text()).isdigit()]
                if not nums or page_number >= max(nums):
                    break
            page_number += 1
            page.wait_for_timeout(250)

        context.close()
        browser.close()

    codes = [x["code"] for x in filtered]
    if len(codes) < 2000:
        raise SystemExit(f"Safety stop: only {len(codes)} Shobi perfumes found in Best sales")
    if codes[:20] != EXPECTED_FIRST_20:
        raise SystemExit("Safety stop: first 20 Best Seller perfumes changed or parser is wrong: " + repr(codes[:20]))

    payload = json.dumps(filtered, ensure_ascii=False, separators=(",", ":"))
    js = (
        "// AUTO-GENERATED from Shobi EN Best sales via Playwright Chromium. Do not edit manually.\n"
        "// rank = perfume-only rank shown on our site; globalRank = original Shobi all-products position.\n"
        f"window.SHOBI_BESTSELLER_RANKING={payload};\n"
        "window.SHOBI_BESTSELLER_CODES=window.SHOBI_BESTSELLER_RANKING.map(x=>x.code);\n"
        "window.SHOBI_BESTSELLER_RANK_BY_CODE=Object.fromEntries(window.SHOBI_BESTSELLER_RANKING.map(x=>[x.code,x.rank]));\n"
        "window.SHOBI_BESTSELLER_GLOBAL_RANK_BY_CODE=Object.fromEntries(window.SHOBI_BESTSELLER_RANKING.map(x=>[x.code,x.globalRank]));\n"
    )
    OUTPUT.write_text(js, encoding="utf-8")

    print(f"SHOBI_GLOBAL_PRODUCTS_SCANNED={global_rank}")
    print(f"SHOBI_NON_PERFUME_OR_NON_MASTER_SKIPPED={skipped_non_perfume}")
    print(f"SHOBI_PERFUME_BESTSELLERS={len(filtered)}")
    print(f"FIRST_25_PERFUME_CODES={codes[:25]}")
    if len(filtered) >= 24:
        print(f"PERFUME_RANK_24={filtered[23]}")
    print(f"OUTPUT={OUTPUT.name}")

if __name__ == "__main__":
    main()
