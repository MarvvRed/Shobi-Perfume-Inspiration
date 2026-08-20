#!/usr/bin/env python3
import csv
import re
import time
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urljoin, urlparse

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


def is_english_url(url):
    try:
        parsed = urlparse(str(url or ""))
        return parsed.netloc.lower() == "leparfum.com.gr" and parsed.path.startswith("/en/")
    except Exception:
        return False


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
    requested = LIST_URL.format(page=page)
    r = session.get(requested, timeout=30, allow_redirects=True)
    r.raise_for_status()
    if not is_english_url(r.url):
        raise SystemExit(f"Safety stop: English catalog request redirected outside /en/: {r.url}")
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
        if not is_english_url(href):
            continue
        desc_el = card.select_one(".product-description-short, .product-description, .product-desc")
        desc = clean(desc_el.get_text(" ", strip=True)) if desc_el else ""
        text = clean(card.get_text(" ", strip=True))
        status = "IN_STOCK" if re.search(r"\bIn Stock\b", text, re.I) else ""
        inspired = extract_inspired(desc)
        title_tail = clean(title[m.end():]).strip(" -–—:|")
        products.append({
            "code": code,
            "base": base_code(code),
            "url": href,
            "description": desc,
            "inspired_by": inspired,
            "title_tail": title_tail,
            "status": status,
        })
    return products, soup


def validate_page_products(products, page):
    if not products:
        return
    suspicious = []
    for product in products:
        fields = [product.get("description", ""), product.get("inspired_by", ""), product.get("title_tail", "")]
        greek_chars = sum(len(GREEK_RE.findall(str(value or ""))) for value in fields)
        if greek_chars:
            suspicious.append((product.get("code", ""), greek_chars))
    if len(suspicious) > max(3, int(len(products) * 0.25)):
        raise SystemExit(
            f"Safety stop: page {page} has Greek text in {len(suspicious)}/{len(products)} extracted products; "
            f"examples={suspicious[:5]}"
        )


def apply_product(row, product):
    if product["url"] and is_english_url(product["url"]):
        row["shobi_url"] = product["url"]
    if product["description"] and not GREEK_RE.search(product["description"]):
        row["description"] = product["description"]
    if product["inspired_by"] and valid_name(product["inspired_by"], row.get("shobi_code")) and not GREEK_RE.search(product["inspired_by"]):
        row["inspired_by"] = product["inspired_by"]
        row["shobi_name"] = product["inspired_by"]
    elif product.get("title_tail") and valid_name(product["title_tail"], row.get("shobi_code")) and not GREEK_RE.search(product["title_tail"]):
        if not valid_name(row.get("shobi_name"), row.get("shobi_code")):
            row["shobi_name"] = product["title_tail"]
        if not valid_name(row.get("inspired_by"), row.get("shobi_code")):
            row["inspired_by"] = product["title_tail"]
    if product["status"]:
        row["status"] = product["status"]


def new_row(fields, product):
    row = {field: "" for field in fields}
    row["shobi_code"] = product["code"]
    name = product["inspired_by"] or product.get("title_tail") or product["code"]
    if GREEK_RE.search(name):
        name = product["code"]
    row["shobi_name"] = name
    row["inspired_by"] = name
    row["shobi_url"] = product["url"]
    row["description"] = product["description"] if product["description"] and not GREEK_RE.search(product["description"]) else ""
    row["status"] = product["status"]
    if "new" in row:
        row["new"] = "1"
    return row


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
        fields = reader.fieldnames
    if not fields or "shobi_code" not in fields:
        raise SystemExit("Invalid shobi-master.csv: missing header/shobi_code")
    starting_count = len(rows)
    if starting_count < 2200:
        raise SystemExit(f"Safety stop: master unexpectedly small ({starting_count} rows)")

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 ShobiDatabaseUpdater/2.1"})

    official_products = []
    page = 1
    while page <= 250:
        html = fetch_page(session, page)
        products, soup = parse_products(html)
        validate_page_products(products, page)
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
    official_products = list(official_exact.values())
    for product in official_products:
        official_by_base[product["base"]].append(product)

    if len(official_products) < 2000:
        raise SystemExit(f"Safety stop: English catalog unexpectedly small ({len(official_products)} unique products)")

    master_base_counts = Counter(base_code(r.get("shobi_code")) for r in rows if r.get("shobi_code"))
    matched = 0
    unmatched = []
    existing_norm = {norm_code(r.get("shobi_code")): r for r in rows if r.get("shobi_code")}

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

        if valid_name(row.get("inspired_by"), row.get("shobi_code")) and not valid_name(row.get("shobi_name"), row.get("shobi_code")):
            row["shobi_name"] = clean(row.get("inspired_by"))

    added = []
    for product in official_products:
        if product["code"] in existing_norm:
            continue
        row = new_row(fields, product)
        rows.append(row)
        existing_norm[product["code"]] = row
        added.append(product["code"])

    english_urls = sum(is_english_url(r.get("shobi_url", "")) for r in rows if r.get("shobi_url"))
    greek_names = [r.get("shobi_code") for r in rows if GREEK_RE.search(str(r.get("shobi_name", ""))) or GREEK_RE.search(str(r.get("inspired_by", "")))]
    greek_desc = [r.get("shobi_code") for r in rows if GREEK_RE.search(str(r.get("description", "")))]

    min_expected_matches = max(2100, int(starting_count * 0.90))
    if matched < min_expected_matches:
        raise SystemExit(f"Safety stop: only {matched}/{starting_count} existing rows matched English Shobi")
    if greek_names:
        raise SystemExit(f"Safety stop: Greek text detected in display names for {len(greek_names)} rows; examples={greek_names[:10]}")
    if len(greek_desc) > 10:
        raise SystemExit(f"Safety stop: Greek descriptions detected in {len(greek_desc)} rows")
    if len(rows) < starting_count:
        raise SystemExit("Safety stop: row count decreased")
    if len(added) > 300:
        raise SystemExit(f"Safety stop: suspiciously large addition ({len(added)} new codes)")

    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    print(f"MASTER_ROWS_BEFORE={starting_count}")
    print(f"OFFICIAL_EN_PRODUCTS={len(official_products)}")
    print(f"MATCHED_EXISTING_ROWS={matched}")
    print(f"UNMATCHED_EXISTING_ROWS={len(unmatched)}")
    print(f"NEW_ROWS_ADDED={len(added)}")
    if added:
        print("NEW_CODES=" + ",".join(added))
    print(f"MASTER_ROWS_AFTER={len(rows)}")
    print(f"ENGLISH_URLS={english_urls}")
    print("SOURCE_LANGUAGE=ENGLISH_ONLY")
    print(f"OUTPUT={OUTPUT.name}")


if __name__ == "__main__":
    main()
