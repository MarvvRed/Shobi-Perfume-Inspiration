#!/usr/bin/env python3
# Isolated audit trigger; no database writes.
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "shobi-master.csv"


def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def norm(v):
    return clean(v).casefold()


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))

    existing = Counter(clean(r.get("brand")) for r in rows if clean(r.get("brand")))
    canonical = {norm(b): b for b in existing}

    slug_to_brands = defaultdict(set)
    for r in rows:
        brand = clean(r.get("brand"))
        if not brand:
            continue
        for value in r.values():
            value = clean(value)
            if not value.startswith(("http://", "https://")):
                continue
            u = urlparse(value)
            host = u.netloc.casefold()
            path = [p for p in u.path.split("/") if p]
            if "fragrantica" in host and len(path) >= 2 and path[0].casefold() == "perfume":
                slug_to_brands[(host, path[1].casefold())].add(brand)
            elif "parfumo" in host and len(path) >= 2 and path[0].casefold() == "perfumes":
                slug_to_brands[(host, path[1].casefold())].add(brand)
            elif "thescentbase" in host and len(path) >= 3 and path[0].casefold() in {"it", "en"} and path[1].casefold() == "perfumes":
                slug_to_brands[(host, path[2].casefold())].add(brand)

    missing = [r for r in rows if not clean(r.get("brand"))]
    resolved, unresolved = [], []

    for r in missing:
        candidates = set()
        reasons = []
        for key in ("inspired_by", "shobi_name"):
            text = clean(r.get(key))
            if " - " in text:
                suffix = clean(text.rsplit(" - ", 1)[1])
                hit = canonical.get(norm(suffix))
                if hit:
                    candidates.add(hit)
                    reasons.append(f"{key}-suffix")

        for value in r.values():
            value = clean(value)
            if not value.startswith(("http://", "https://")):
                continue
            u = urlparse(value)
            host = u.netloc.casefold()
            path = [p for p in u.path.split("/") if p]
            lookup = None
            if "fragrantica" in host and len(path) >= 2 and path[0].casefold() == "perfume":
                lookup = (host, path[1].casefold())
            elif "parfumo" in host and len(path) >= 2 and path[0].casefold() == "perfumes":
                lookup = (host, path[1].casefold())
            elif "thescentbase" in host and len(path) >= 3 and path[0].casefold() in {"it", "en"} and path[1].casefold() == "perfumes":
                lookup = (host, path[2].casefold())
            if lookup and len(slug_to_brands.get(lookup, ())) == 1:
                candidates.add(next(iter(slug_to_brands[lookup])))
                reasons.append("external-url")

        if len(candidates) == 1:
            resolved.append((r.get("shobi_code", ""), next(iter(candidates)), "+".join(sorted(set(reasons))), clean(r.get("inspired_by"))))
        else:
            unresolved.append((r.get("shobi_code", ""), ";".join(sorted(candidates)), clean(r.get("inspired_by")), clean(r.get("shobi_url"))))

    print(f"TOTAL_ROWS={len(rows)}")
    print(f"EXISTING_BRANDS={len(existing)}")
    print(f"BLANK_BRANDS={len(missing)}")
    print(f"SAFE_AUTO_FILL={len(resolved)}")
    print(f"UNRESOLVED={len(unresolved)}")
    print("--- SAFE AUTO FILL ---")
    for code, brand, reason, inspired in resolved:
        print(f"{code}\t{brand}\t{reason}\t{inspired}")
    print("--- UNRESOLVED ---")
    for code, candidates, inspired, url in unresolved:
        print(f"{code}\t{candidates}\t{inspired}\t{url}")


if __name__ == "__main__":
    main()
