#!/usr/bin/env python3
import csv
import re
import time
from collections import defaultdict
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "shobi-master.csv"
OUTPUT = ROOT / "shobi-master-en.csv"
BASE = "https://leparfum.com.gr"
LIST_URL = BASE + "/en/perfumes?page={page}"

CODE_RE = re.compile(r"^\s*(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-ZΑ-Ω0-9]+))?\b", re.I)
INSPIRED_RE = re.compile(r"Inspired by the fragrance notes of\s+(.+?)(?:\.|$)", re.I)
GREEK_RE = re.compile(r"[\u0370-\u03ff\u1f00-\u1fff]")
GREEK_TO_LATIN = str.maketrans({"Ν": "N", "Μ": "M", "Ε": "E", "Ρ": "P", "Χ": "X"})
BASE_ALIASES = {"1685-FRED": "1685-FRE"}


def clean(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def norm_full_code(value):
    value = clean(value).upper().translate(GREEK_TO_LATIN)
    m = re.match(r"^(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-Z0-9]+))?", value)
    if not m:
        return value
    base = f"{m.group(1)}-{m.group(2)}"
    base = BASE_ALIASES.get(base, base)
    return f"{base} {m.group(3)}" if m.group(3) else base


def base_code(value):
    return norm_full_code(value).split(" ", 1)[0]


def fetch_page(session, page):
    r = session.get(LIST_URL.format(page=page), timeout=30)
    r.raise_for_status()
    return r.text


def parse_products(html):
    soup = BeautifulSoup(html, "html.parser")
    products = []
    for card in soup.select("article.product-miniature"):
        title_el = card.select_one("h2.product-title a, .product-title a")
        if not title_el:
            continue
        title = clean(title_el.get_text(" ", strip=True))
        m = CODE_RE.search(title)
        if not m:
            continue
        raw_code = f"{m.group(1)}-{m.group(2)}" + (f" {m.group(3)}" if m.group(3) else "")
        desc_el = card.select_one(".product-description-short, .product-description, .product-desc")
        desc = clean(desc_el.get_text(" ", strip=True)) if desc_el else ""
        text = clean(card.get_text(" ", strip=True))
        inspired = ""
        im = INSPIRED_RE.search(desc)
        if im:
            inspired = clean(im.group(1))
        products.append({
            "full_code": norm_full_code(raw_code),
            "base_code": base_code(raw_code),
            "url": urljoin(BASE, title_el.get("href") or ""),
            "description": desc,
            "inspired_by": inspired,
            "status": "IN_STOCK" if re.search(r"\bIn Stock\b", text, re.I) else "",
        })
    return products, soup


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
        fields = reader.fieldnames
    if not fields or len(rows) < 500:
        raise SystemExit("Invalid shobi-master.csv")

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 ShobiDatabaseUpdater/1.0"})

    official = []
    for page in range(1, 201):
        products, soup = parse_products(fetch_page(session, page))
        if not products:
            if page == 1:
                raise SystemExit("English Shobi page parser found no products")
            break
        official.extend(products)
        next_link = soup.select_one("a.next, .pagination .next a, a[rel='next']")
        if not next_link:
            page_links = [int(clean(a.get_text())) for a in soup.select(".pagination a") if clean(a.get_text()).isdigit()]
            if (page_links and page >= max(page_links)) or not page_links:
                break
        time.sleep(0.15)

    by_full = {}
    by_base = defaultdict(list)
    for p in official:
        by_full[p["full_code"]] = p
        by_base[p["base_code"]].append(p)

    master_base_counts = defaultdict(int)
    for row in rows:
        master_base_counts[base_code(row.get("shobi_code"))] += 1

    matches = english_urls = english_desc = 0
    unmatched = []
    for row in rows:
        full = norm_full_code(row.get("shobi_code"))
        base = base_code(full)
        p = by_full.get(full)
        if not p and master_base_counts[base] == 1 and len(by_base.get(base, [])) == 1:
            p = by_base[base][0]
        if not p:
            unmatched.append(row.get("shobi_code", ""))
            continue
        matches += 1
        if "/en/" in p["url"]:
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

    if matches < 2260:
        raise SystemExit(f"Safety stop: only {matches}/{len(rows)} rows matched English Shobi")
    if english_urls < 2260:
        raise SystemExit(f"Safety stop: only {english_urls} English URLs")
    if english_desc < 2100:
        raise SystemExit(f"Safety stop: only {english_desc} non-Greek English descriptions")

    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    print(f"MASTER_ROWS={len(rows)}")
    print(f"OFFICIAL_EN_PRODUCTS={len(official)}")
    print(f"MATCHED_MASTER_ROWS={matches}")
    print(f"UNMATCHED_MASTER_ROWS={len(unmatched)}")
    print(f"ENGLISH_URLS={english_urls}")
    print(f"ENGLISH_DESCRIPTIONS={english_desc}")
    if unmatched:
        print("UNMATCHED_CODES=" + ",".join(unmatched))
    print(f"OUTPUT={OUTPUT.name}")


if __name__ == "__main__":
    main()
