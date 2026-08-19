#!/usr/bin/env python3
import csv
import re
import time
from collections import Counter, defaultdict
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
GREEK_RE = re.compile(r"[\u0370-\u03ff\u1f00-\u1fff]")
BAD_NAMES = {"", "notes", "note", "of", "the fragrance notes", "the fragrance notes of", "n/a", "na", "unknown", "-"}

# Confirmed differences between historical master codes and the current English catalog.
CODE_ALIASES = {
    "1685-FRED N": "1685-FRE N",
    "1068-CHA": "1068-CHA M",
    "1930-VIC": "1930-VIC M",
    "1156-HER": "1156-HER M",
    "1065-CHA": "1065-CHA M",
}


def clean(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def valid_name(value, code=""):
    value = clean(value)
    return bool(value) and value.casefold() not in BAD_NAMES and value != clean(code)


def extract_inspired(desc):
    desc = clean(desc)
    patterns = [
        r"\bInspired by the fragrance notes of\s+(.+?)(?:\.|$)",
        r"\bInspired by the notes of\s+(.+?)(?:\.|$)",
        r"\bInspired by the notes\s+(.+?)(?:\.|$)",
        r"\bInspired by the fragrance\s+(.+?)(?:\.|$)",
        r"\bInspired by\s+(.+?)(?:\.|$)",
        r"\bby the fragrance notes of\s+(.+?)(?:\.|$)",
    ]
    for pattern in patterns:
        m = re.search(pattern, desc, re.I)
        if not m:
            continue
        candidate = clean(m.group(1)).strip(" :-")
        if valid_name(candidate):
            return candidate
    return ""


def raw_code(value):
    return clean(value).upper().replace("Ν", "N")


def norm_code(value):
    value = raw_code(value)
    m = re.match(r"^(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-Z0-9]+))?", value)
    if not m:
        return value
    code = f"{m.group(1)}-{m.group(2)}"
    if m.group(3):
        code += f" {m.group(3)}"
    return CODE_ALIASES.get(code, code)


def base_code(value):
    code = norm_code(value)
    m = re.match(r"^(\d{1,5}-[A-Z0-9]+)", code)
    return m.group(1) if m else code


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
        source_code = f"{m.group(1)}-{m.group(2)}"
        if m.group(3):
            source_code += f" {m.group(3)}"
        code = norm_code(source_code)
        href = urljoin(BASE, title_el.get("href") or "")
        desc_el = card.select_one(".product-description-short, .product-description, .product-desc")
        desc = clean(desc_el.get_text(" ", strip=True)) if desc_el else ""
        text = clean(card.get_text(" ", strip=True))
        status = "IN_STOCK" if re.search(r"\bIn Stock\b", text, re.I) else ""
        inspired = extract_inspired(desc)
        products.append({
            "code": code,
            "base": base_code(code),
            "url": href,
            "description": desc,
            "inspired_by": inspired,
            "status": status,
        })
    return products, soup


def apply_product(row, product):
    if product["url"] and "/en/" in product["url"]:
        row["shobi_url"] = product["url"]
    if product["description"]:
        row["description"] = product["description"]
    if product["inspired_by"] and valid_name(product["inspired_by"], row.get("shobi_code")):
        row["inspired_by"] = product["inspired_by"]
        row["shobi_name"] = product["inspired_by"]
    if product["status"]:
        row["status"] = product["status"]


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
        fields = reader.fieldnames
    if not fields or len(rows) != 2273:
        raise SystemExit(f"Invalid shobi-master.csv row count: {len(rows)}")

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 ShobiDatabaseUpdater/1.0"})

    official_products = []
    page = 1
    while page <= 200:
        html = fetch_page(session, page)
        products, soup = parse_products(html)
        if not products:
            if page == 1:
                raise SystemExit("English Shobi page parser found no products")
            break
        official_products.extend(products)
        next_link = soup.select_one("a.next, .pagination .next a, a[rel='next']")
        if not next_link:
            page_links = [int(clean(a.get_text())) for a in soup.select(".pagination a") if clean(a.get_text()).isdigit()]
            if not page_links or page >= max(page_links):
                break
        page += 1
        time.sleep(0.15)

    official_exact = {}
    official_by_base = defaultdict(list)
    for product in official_products:
        official_exact[product["code"]] = product
        official_by_base[product["base"]].append(product)

    master_base_counts = Counter(base_code(r.get("shobi_code")) for r in rows if r.get("shobi_code"))
    matched = 0
    unmatched = []

    for row in rows:
        source = raw_code(row.get("shobi_code"))
        code = norm_code(source)
        product = None

        if source in {"390-ACQ WP", "390-ACQ MP"}:
            wanted = "/fragrances-for-women/" if source.endswith(" WP") else "/fragrances-for-men/"
            product = next((p for p in official_by_base.get("390-ACQ", []) if wanted in p.get("url", "")), None)
        else:
            product = official_exact.get(code)

        if product is None:
            base = base_code(code)
            candidates = official_by_base.get(base, [])
            if master_base_counts[base] == 1 and len(candidates) == 1:
                product = candidates[0]

        if product is None:
            unmatched.append(row.get("shobi_code"))
            continue

        apply_product(row, product)
        matched += 1

        # Never leave a code/placeholder as display name when inspired_by is already valid.
        if valid_name(row.get("inspired_by"), row.get("shobi_code")) and not valid_name(row.get("shobi_name"), row.get("shobi_code")):
            row["shobi_name"] = clean(row.get("inspired_by"))

    english_urls = sum("/en/" in str(r.get("shobi_url", "")) for r in rows)
    english_desc = sum(bool(r.get("description")) and not GREEK_RE.search(str(r.get("description", ""))) for r in rows)

    if matched != 2273:
        raise SystemExit(f"Safety stop: only {matched}/2273 master rows matched English Shobi; unresolved={unmatched}")
    if english_urls != 2273:
        raise SystemExit(f"Safety stop: only {english_urls}/2273 English URLs")
    if english_desc < 2100:
        raise SystemExit(f"Safety stop: only {english_desc} non-Greek descriptions")

    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    print(f"MASTER_ROWS={len(rows)}")
    print(f"OFFICIAL_EN_PRODUCTS={len(official_products)}")
    print(f"MATCHED_MASTER_ROWS={matched}")
    print("UNMATCHED_MASTER_ROWS=0")
    print(f"ENGLISH_URLS={english_urls}")
    print(f"ENGLISH_DESCRIPTIONS={english_desc}")
    print(f"OUTPUT={OUTPUT.name}")


if __name__ == "__main__":
    main()
