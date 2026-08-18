#!/usr/bin/env python3
# Validation run: English catalog candidate only; live database is untouched.
import csv
import re
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "shobi-master.csv"
OUTPUT = ROOT / "shobi-master-en.csv"
BASE = "https://leparfum.com.gr"
LIST_URL = BASE + "/en/perfumes?page={page}"

# The numeric-brand part is the stable Shobi code. Category suffixes such as
# M, MP, N, W, EL or LUX can differ between catalog views/languages.
CODE_RE = re.compile(r"^\s*(\d{1,5})\s*-\s*([A-Z0-9]+)\b", re.I)
INSPIRED_RE = re.compile(r"Inspired by the fragrance notes of\s+(.+?)(?:\.|$)", re.I)
GREEK_RE = re.compile(r"[\u0370-\u03ff\u1f00-\u1fff]")
CODE_ALIASES = {
    "1685-FRED": "1685-FRE",
}


def norm_code(value):
    value = re.sub(r"\s+", " ", str(value or "").strip()).upper()
    m = re.match(r"^(\d{1,5})\s*-\s*([A-Z0-9]+)", value)
    code = f"{m.group(1)}-{m.group(2)}" if m else value
    return CODE_ALIASES.get(code, code)


def clean(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def fetch_page(session, page):
    url = LIST_URL.format(page=page)
    r = session.get(url, timeout=30)
    r.raise_for_status()
    return r.text


def parse_products(html):
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("article.product-miniature")
    products = []
    for card in cards:
        title_el = card.select_one("h2.product-title a, .product-title a")
        if not title_el:
            continue
        title = clean(title_el.get_text(" ", strip=True))
        href = urljoin(BASE, title_el.get("href") or "")
        m = CODE_RE.search(title)
        if not m:
            continue
        code = norm_code(f"{m.group(1)}-{m.group(2)}")
        desc_el = card.select_one(".product-description-short, .product-description, .product-desc")
        desc = clean(desc_el.get_text(" ", strip=True)) if desc_el else ""
        text = clean(card.get_text(" ", strip=True))
        status = "IN_STOCK" if re.search(r"\bIn Stock\b", text, re.I) else ""
        inspired = ""
        im = INSPIRED_RE.search(desc)
        if im:
            inspired = clean(im.group(1))
        products.append({
            "code": code,
            "url": href,
            "description": desc,
            "inspired_by": inspired,
            "status": status,
        })
    return products, soup


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
        fields = reader.fieldnames
    if not fields or len(rows) < 500:
        raise SystemExit("Invalid shobi-master.csv")

    by_code = {norm_code(r.get("shobi_code")): r for r in rows if r.get("shobi_code")}
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 ShobiDatabaseUpdater/1.0"})

    official = {}
    page = 1
    max_pages = 200
    while page <= max_pages:
        html = fetch_page(session, page)
        products, soup = parse_products(html)
        if not products:
            if page == 1:
                raise SystemExit("English Shobi page parser found no products")
            break
        for p in products:
            official[p["code"]] = p

        next_link = soup.select_one("a.next, .pagination .next a, a[rel='next']")
        if not next_link:
            page_links = []
            for a in soup.select(".pagination a"):
                t = clean(a.get_text())
                if t.isdigit():
                    page_links.append(int(t))
            if page_links and page >= max(page_links):
                break
            if not page_links:
                break
        page += 1
        time.sleep(0.15)

    matches = 0
    english_desc = 0
    english_urls = 0
    unmatched = []
    for code, row in by_code.items():
        p = official.get(code)
        if not p:
            unmatched.append(code)
            continue
        matches += 1
        if p["url"] and "/en/" in p["url"]:
            row["shobi_url"] = p["url"]
            english_urls += 1
        if p["description"]:
            row["description"] = p["description"]
            if not GREEK_RE.search(p["description"]):
                english_desc += 1
        if p["inspired_by"]:
            row["inspired_by"] = p["inspired_by"]
            row["shobi_name"] = p["inspired_by"]
        if p["status"]:
            row["status"] = p["status"]

    minimum_matches = max(1800, int(len(rows) * 0.80))
    if matches < minimum_matches:
        raise SystemExit(f"Safety stop: only {matches}/{len(rows)} master codes matched English Shobi")
    if english_urls < minimum_matches:
        raise SystemExit(f"Safety stop: only {english_urls} English URLs")
    if english_desc < 1500:
        raise SystemExit(f"Safety stop: only {english_desc} non-Greek English descriptions")

    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    print(f"MASTER_ROWS={len(rows)}")
    print(f"OFFICIAL_EN_PRODUCTS={len(official)}")
    print(f"MATCHED_MASTER_CODES={matches}")
    print(f"UNMATCHED_MASTER_CODES={len(unmatched)}")
    print(f"ENGLISH_URLS={english_urls}")
    print(f"ENGLISH_DESCRIPTIONS={english_desc}")
    if unmatched:
        print("UNMATCHED_CODES=" + ",".join(unmatched))
    print(f"OUTPUT={OUTPUT.name}")


if __name__ == "__main__":
    main()