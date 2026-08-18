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

# Capture the stable code and an optional category suffix (M/W/MP/WP/N/EL/LUX/AR).
# Greek capital Nu (Ν) is normalized to Latin N because it appears on some Shobi pages.
CODE_RE = re.compile(r"^\s*(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-ZΑ-Ω0-9]+))?\b", re.I)
INSPIRED_RE = re.compile(
    r"(?:Inspired by the fragrance(?: notes)?(?: of)?|inspired by the notes of|by the fragrance notes of)\s+(.+?)(?:\.|$)",
    re.I,
)
GREEK_RE = re.compile(r"[\u0370-\u03ff\u1f00-\u1fff]")

# Confirmed catalog spelling/format differences.
CODE_ALIASES = {
    "1685-FRED N": "1685-FRE N",
    "1068-CHA": "1068-CHA M",
    "390-ACQ MP": "390-ACQ",
}


def clean(text):
    return re.sub(r"\s+", " ", str(text or "")).strip()


def norm_code(value):
    value = clean(value).upper().replace("Ν", "N")
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
        raw_code = f"{m.group(1)}-{m.group(2)}"
        if m.group(3):
            raw_code += f" {m.group(3)}"
        code = norm_code(raw_code)
        href = urljoin(BASE, title_el.get("href") or "")
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
    if product["inspired_by"]:
        row["inspired_by"] = product["inspired_by"]
        row["shobi_name"] = product["inspired_by"]
    if product["status"]:
        row["status"] = product["status"]


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
        fields = reader.fieldnames
    if not fields or len(rows) < 500:
        raise SystemExit("Invalid shobi-master.csv")

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

    # Keep exact full-code identities first. This prevents WP/MP or W/M variants
    # from being collapsed into one record.
    official_exact = {}
    official_by_base = defaultdict(list)
    for product in official_products:
        official_exact[product["code"]] = product
        official_by_base[product["base"]].append(product)

    master_base_counts = Counter(base_code(r.get("shobi_code")) for r in rows if r.get("shobi_code"))
    matched = 0
    unmatched = []

    for row in rows:
        raw = row.get("shobi_code")
        code = norm_code(raw)
        product = official_exact.get(code)

        # Fallback only when both sides have a single unambiguous base identity.
        if product is None:
            base = base_code(code)
            candidates = official_by_base.get(base, [])
            if master_base_counts[base] == 1 and len(candidates) == 1:
                product = candidates[0]

        if product is None:
            unmatched.append(raw)
            continue

        apply_product(row, product)
        matched += 1

    english_urls = sum("/en/" in str(r.get("shobi_url", "")) for r in rows)
    english_desc = sum(bool(r.get("description")) and not GREEK_RE.search(str(r.get("description", ""))) for r in rows)

    # Row-level safety: do not silently lose or collapse master records.
    if len(rows) != 2273:
        raise SystemExit(f"Safety stop: expected 2273 master rows, got {len(rows)}")
    if matched < 2268:
        raise SystemExit(f"Safety stop: only {matched}/{len(rows)} master rows matched English Shobi")
    if english_urls < 2268:
        raise SystemExit(f"Safety stop: only {english_urls} English URLs")
    if english_desc < 2100:
        raise SystemExit(f"Safety stop: only {english_desc} non-Greek descriptions")

    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    print(f"MASTER_ROWS={len(rows)}")
    print(f"OFFICIAL_EN_PRODUCTS={len(official_products)}")
    print(f"MATCHED_MASTER_ROWS={matched}")
    print(f"UNMATCHED_MASTER_ROWS={len(unmatched)}")
    if unmatched:
        print("UNMATCHED_CODES=" + ",".join(unmatched))
    print(f"ENGLISH_URLS={english_urls}")
    print(f"ENGLISH_DESCRIPTIONS={english_desc}")
    print(f"OUTPUT={OUTPUT.name}")


if __name__ == "__main__":
    main()
