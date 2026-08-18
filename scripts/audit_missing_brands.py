#!/usr/bin/env python3
# Isolated audit trigger; no database writes.
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "shobi-master.csv"

# Code keys below are explicit identities confirmed by the perfume names carried
# by the same Shobi records. They are used only for rows whose brand is blank.
VERIFIED_KEYS = {
    "MIN": "Mind Games",
    "LUS": "Lush",
    "KYLJ": "Kylie Jenner",
    "BORN": "BORNTOSTANDOUT",
    "GISS": "Gissah",
    "ATEL": "Atelier Materi",
    "RARB": "Rare Beauty",
    "INI": "Initio Parfums Privés",
    "MOOD": "Mood London",
    "OMA": "Omanluxury",
    "ARM": "Armani",
    "LES": "Les Liquides Imaginaires",
    "VIRT": "The 7 Virtues",
    "BOYS": "Boy Smells",
    "OBVI": "Obvious",
    "NICO": "Nicolai Parfumeur Createur",
    "FRAG": "Fragrance Du Bois",
    "KIL": "Kilian",
    "KAJ": "Kajal",
    "MIL": "Miller Harris",
    "SAB": "Sabrina Carpenter",
    "NAV": "Navitus Parfums",
    "BYRP": "Byron Parfums",
    "ROOM": "Room 1015",
    "GRIT": "Gritti",
    "CHAB": "Chabaud",
    "FUGA": "Fugazzi",
    "PAZZ": "Lorenzo Pazzaglia",
    "HARM": "The Harmonist",
    "NES": "Nest",
    "CHAR": "Charlotte Tilbury",
    "ARMA": "Armaf",
    "GLO": "Glossier",
    "ELIZ": "Elizabeth Arden",
    "BAN": "Banana Republic",
    "FRED": "Frederic Malle",
    "MIS": "Missguided",
}


def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def norm(v):
    return clean(v).casefold()


def code_brand_key(code):
    m = re.match(r"^\s*\d+\s*-\s*([A-Z0-9]+)", clean(code).upper())
    return m.group(1) if m else ""


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))

    existing = Counter(clean(r.get("brand")) for r in rows if clean(r.get("brand")))
    canonical = {norm(b): b for b in existing}
    slug_to_brands = defaultdict(set)
    key_to_brands = defaultdict(set)

    for r in rows:
        brand = clean(r.get("brand"))
        if not brand:
            continue
        key = code_brand_key(r.get("shobi_code"))
        if key:
            key_to_brands[key].add(brand)
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
        for field in ("inspired_by", "shobi_name"):
            text = clean(r.get(field))
            if " - " in text:
                suffix = clean(text.rsplit(" - ", 1)[1])
                hit = canonical.get(norm(suffix))
                if hit:
                    candidates.add(hit)
                    reasons.append(f"{field}-suffix")

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

        key = code_brand_key(r.get("shobi_code"))
        if key and len(key_to_brands.get(key, ())) == 1:
            candidates.add(next(iter(key_to_brands[key])))
            reasons.append("shobi-code-key")
        elif key in VERIFIED_KEYS:
            candidates.add(VERIFIED_KEYS[key])
            reasons.append("verified-code-key")

        if len(candidates) == 1:
            resolved.append((r.get("shobi_code", ""), next(iter(candidates)), "+".join(sorted(set(reasons))), clean(r.get("inspired_by"))))
        else:
            unresolved.append((r.get("shobi_code", ""), ";".join(sorted(candidates)), clean(r.get("inspired_by")), clean(r.get("shobi_url"))))

    print(f"TOTAL_ROWS={len(rows)}")
    print(f"EXISTING_BRANDS={len(existing)}")
    print(f"BLANK_BRANDS={len(missing)}")
    print(f"SAFE_AUTO_FILL={len(resolved)}")
    print(f"UNRESOLVED={len(unresolved)}")
    print("--- UNRESOLVED ---")
    for code, candidates, inspired, url in unresolved:
        print(f"{code}\t{candidates}\t{inspired}\t{url}")


if __name__ == "__main__":
    main()
