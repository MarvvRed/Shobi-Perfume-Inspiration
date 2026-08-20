#!/usr/bin/env python3
import csv
import json
import re
import time
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
MASTER_DIR = ROOT / "Shobi Master Database"
BASELINE = MASTER_DIR / "shobi-master-v1.csv"
CURRENT = MASTER_DIR / "shobi-master-current.csv"
CANDIDATE = MASTER_DIR / "shobi-master-candidate.csv"
REPORT_JSON = MASTER_DIR / "latest-sync-report.json"
REPORT_CSV = MASTER_DIR / "latest-sync-changes.csv"
BASE = "https://leparfum.com.gr"
LIST_URL = BASE + "/en/perfumes?page={page}"
RULE = "Choose+Bottle+Extra Essence"
FIELDS = [
    "prestashop_product_id","shobi_code","shobi_name","reference",
    "reference_prefix","inspired_by","category","price_from_eur",
    "official_description","url","first_seen","last_seen","status",
    "classification_rule","source"
]


def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def extract_inspired(desc):
    desc = clean(desc)
    for pat in [
        r"Inspired by the fragrance notes of\s+(.+?)(?:\.|$)",
        r"Inspired by the fragrance of\s+(.+?)(?:\.|$)",
        r"Inspired by\s+(.+?)(?:\.|$)",
        r"Ιnspired by the fragrance notes of\s+(.+?)(?:\.|$)",
        r"Ιnspired by\s+(.+?)(?:\.|$)",
    ]:
        m = re.search(pat, desc, re.I)
        if m:
            return clean(m.group(1)).strip(" :-")
    return ""


def extract_code(name, desc):
    for value in (name, desc):
        m = re.match(r"^\s*(\d{2,5}-[A-Za-z0-9]+)", value or "")
        if m:
            return m.group(1)
    return ""


def price_value(text):
    m = re.search(r"(\d+(?:[\.,]\d+)?)", clean(text))
    return m.group(1).replace(",", ".") if m else ""


def normalize_compare(field, value):
    value = clean(value)
    if field == "price_from_eur" and value:
        try:
            return f"{float(value.replace(',', '.')):.6f}"
        except ValueError:
            pass
    return value


def load_csv(path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path, rows, fields=FIELDS):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def is_shobi_card(card):
    for a in card.select("a[href]"):
        h = (a.get("href") or "").lower()
        if "choose-" in h and "bottle-" in h and "extra_essence-" in h:
            return a.get("href") or ""
    return ""


def parse_page(html):
    soup = BeautifulSoup(html, "html.parser")
    all_cards = soup.select("article.product-miniature[data-id-product]")
    rows = []
    for card in all_cards:
        signature_href = is_shobi_card(card)
        if not signature_href:
            continue
        pid = clean(card.get("data-id-product"))
        title_node = card.select_one(".product-title")
        ref_node = card.select_one(".product-reference")
        category_node = card.select_one(".product-category-name")
        desc_node = card.select_one(".product-description-short")
        price_node = card.select_one(".product-price")
        title = clean(title_node.get_text(" ", strip=True) if title_node else "")
        reference = clean(ref_node.get_text(" ", strip=True) if ref_node else "")
        category = clean(category_node.get_text(" ", strip=True) if category_node else "")
        desc = clean(desc_node.get_text(" ", strip=True) if desc_node else "")
        price = price_value(price_node.get_text(" ", strip=True) if price_node else "")
        url = urljoin(BASE, signature_href.split("#", 1)[0])
        pm = re.match(r"^[A-Za-z]+", reference)
        rows.append({
            "prestashop_product_id": pid,
            "shobi_code": extract_code(title, desc),
            "shobi_name": title,
            "reference": reference,
            "reference_prefix": pm.group(0).upper() if pm else "",
            "inspired_by": extract_inspired(desc),
            "category": category,
            "price_from_eur": price,
            "official_description": desc,
            "url": url,
        })
    return rows, len(all_cards), soup


def fetch_catalog():
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    })
    found = []
    total_cards = 0
    for page in range(1, 251):
        requested = LIST_URL.format(page=page)
        r = s.get(requested, timeout=45, allow_redirects=True)
        print(f"FETCH page={page} status={r.status_code} url={r.url} bytes={len(r.content)}")
        r.raise_for_status()
        rows, cards, soup = parse_page(r.text)
        print(f"PARSE page={page} cards={cards} shobi={len(rows)} cumulative_cards={total_cards + cards} cumulative_shobi={len(found) + len(rows)}")
        if page == 1 and cards == 0:
            title = clean(soup.title.get_text(" ", strip=True) if soup.title else "")
            print(f"PAGE1_TITLE={title}")
            print(f"PAGE1_HTML_PREFIX={clean(r.text[:1200])}")
            raise SystemExit("Safety stop: no product cards found on /en/perfumes")
        if cards == 0:
            break
        found.extend(rows)
        total_cards += cards
        next_link = soup.select_one("a.next, .pagination .next a, a[rel='next']")
        nums = [int(clean(a.get_text())) for a in soup.select(".pagination a") if clean(a.get_text()).isdigit()]
        print(f"PAGINATION page={page} next={bool(next_link)} numeric_pages={nums[-10:] if nums else []}")
        if not next_link:
            if not nums or page >= max(nums):
                break
        time.sleep(0.20)
    print(f"FETCH_COMPLETE pages_processed={page} total_cards={total_cards} shobi_rows={len(found)}")
    return found, total_cards


def merge_live_with_history(live_rows, old_rows):
    today = date.today().isoformat()
    old = {r["prestashop_product_id"]: r for r in old_rows}
    merged = []
    for live in live_rows:
        prev = old.get(live["prestashop_product_id"])
        row = {k: "" for k in FIELDS}
        if prev:
            row.update(prev)
        for k, v in live.items():
            if v != "" or not prev:
                row[k] = v
        row["first_seen"] = prev.get("first_seen", today) if prev else today
        row["last_seen"] = today
        row["status"] = "ACTIVE"
        row["classification_rule"] = RULE
        row["source"] = "SHOBI_LIVE_PAGINATED"
        merged.append(row)
    return merged


def changed_fields(a, b):
    ignore = {"last_seen", "source"}
    return [
        k for k in FIELDS
        if k not in ignore
        and normalize_compare(k, a.get(k)) != normalize_compare(k, b.get(k))
    ]


def main():
    old_path = CURRENT if CURRENT.exists() else BASELINE
    if not old_path.exists():
        raise SystemExit("Safety stop: no official Shobi Master baseline found")
    old_rows = load_csv(old_path)
    old_by_id = {r["prestashop_product_id"]: r for r in old_rows}
    print(f"BASELINE file={old_path.name} rows={len(old_rows)}")

    raw_live, total_cards = fetch_catalog()
    ids = [r["prestashop_product_id"] for r in raw_live]
    print(f"VALIDATE total_cards={total_cards} shobi={len(raw_live)} unique_ids={len(set(ids))}")
    if any(not x for x in ids):
        raise SystemExit("Safety stop: live Shobi product missing prestashop_product_id")
    if len(ids) != len(set(ids)):
        raise SystemExit("Safety stop: duplicate prestashop_product_id in live Shobi catalog")
    if len(raw_live) < 2200:
        raise SystemExit(f"Safety stop: only {len(raw_live)} Shobi perfumes detected")
    if total_cards < 2400:
        raise SystemExit(f"Safety stop: only {total_cards} total Perfumes cards detected")
    if abs(len(raw_live) - len(old_rows)) > max(300, int(len(old_rows) * 0.12)):
        raise SystemExit(f"Safety stop: suspicious catalog-size jump old={len(old_rows)} live={len(raw_live)}")

    merged = merge_live_with_history(raw_live, old_rows)
    live_by_id = {r["prestashop_product_id"]: r for r in merged}
    old_ids, live_ids = set(old_by_id), set(live_by_id)
    new_ids = sorted(live_ids - old_ids, key=lambda x: int(x) if x.isdigit() else x)
    removed_ids = sorted(old_ids - live_ids, key=lambda x: int(x) if x.isdigit() else x)
    modified = []
    for pid in sorted(old_ids & live_ids, key=lambda x: int(x) if x.isdigit() else x):
        fields = changed_fields(old_by_id[pid], live_by_id[pid])
        if fields:
            modified.append((pid, fields))

    changes = []
    for pid in new_ids:
        r = live_by_id[pid]
        changes.append({"change":"NEW","prestashop_product_id":pid,"shobi_name":r["shobi_name"],"reference":r["reference"],"fields":""})
    for pid, fields in modified:
        r = live_by_id[pid]
        changes.append({"change":"MODIFIED","prestashop_product_id":pid,"shobi_name":r["shobi_name"],"reference":r["reference"],"fields":"|".join(fields)})
    for pid in removed_ids:
        r = old_by_id[pid]
        changes.append({"change":"REMOVED","prestashop_product_id":pid,"shobi_name":r["shobi_name"],"reference":r["reference"],"fields":""})

    write_csv(CANDIDATE, merged)
    write_csv(REPORT_CSV, changes, ["change","prestashop_product_id","shobi_name","reference","fields"])
    report = {
        "date": date.today().isoformat(),
        "baseline_file": old_path.name,
        "total_perfumes_cards": total_cards,
        "shobi_perfumes": len(merged),
        "new": len(new_ids),
        "modified": len(modified),
        "removed": len(removed_ids),
        "changed": bool(changes),
        "classification_rule": RULE,
        "primary_key": "prestashop_product_id",
        "safety": "PASS",
    }
    REPORT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
