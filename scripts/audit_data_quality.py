#!/usr/bin/env python3
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "shobi-master.csv"
MASTER_EN = ROOT / "shobi-master-en.csv"


def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def code_key(code):
    m = re.match(r"^\s*(\d+)\s*-\s*([A-Z0-9]+)", clean(code).upper())
    return (m.group(1), m.group(2)) if m else ("", "")


def load(path):
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
        return reader.fieldnames or [], rows


def valid_http(value):
    value = clean(value)
    if not value:
        return True
    if not value.startswith(("http://", "https://")):
        return False
    u = urlparse(value)
    return bool(u.netloc)


def main():
    fields, rows = load(MASTER)
    en_fields, en_rows = load(MASTER_EN)
    print(f"TOTAL_ROWS={len(rows)}")
    print(f"TOTAL_COLUMNS={len(fields)}")
    print(f"EN_ROWS={len(en_rows)}")
    print(f"EN_COLUMNS={len(en_fields)}")
    print("FIELDS=" + "|".join(fields))
    print("--- BLANK COUNTS ---")
    for f in fields:
        print(f"{f}\t{sum(1 for r in rows if not clean(r.get(f)))}")
    for key in ("shobi_code", "shobi_url"):
        counts = Counter(clean(r.get(key)) for r in rows if clean(r.get(key)))
        dups = {k:v for k,v in counts.items() if v > 1}
        print(f"DUPLICATE_{key.upper()}={len(dups)}")
        for value, count in sorted(dups.items(), key=lambda x:(-x[1], x[0]))[:100]:
            print(f"DUP\t{key}\t{count}\t{value}")
    malformed=[]
    for i,r in enumerate(rows,2):
        for f in fields:
            if "url" in f.casefold() and clean(r.get(f)) and not valid_http(r.get(f)):
                malformed.append((i,r.get("shobi_code",""),f,clean(r.get(f))))
    print(f"MALFORMED_URLS={len(malformed)}")
    for item in malformed[:200]: print("BADURL\t"+"\t".join(map(str,item)))
    suspicious=[]; contamination=[]
    artifact_re=re.compile(r"(?:\badd to cart\b|\bfrom\s*€|\b\d+\s+reviews?\b|\b(?:niche perfumes|elegants fragrances|fragrances for (?:men|women))\b)",re.I)
    for i,r in enumerate(rows,2):
        code=clean(r.get("shobi_code")); inspired=clean(r.get("inspired_by")); name=clean(r.get("shobi_name"))
        for f,v in (("inspired_by",inspired),("shobi_name",name)):
            low=v.casefold()
            if not v or v==code or low in {"notes","note","of","n/a","na","unknown","-"}: suspicious.append((i,code,f,v))
            if artifact_re.search(v): contamination.append((i,code,f,v))
    print(f"SUSPICIOUS_NAMES={len(suspicious)}")
    for item in suspicious[:300]: print("SUSP\t"+"\t".join(map(str,item)))
    print(f"UI_TEXT_CONTAMINATION={len(contamination)}")
    for item in contamination[:300]: print("CONTAM\t"+"\t".join(map(str,item)))
    key_brands=defaultdict(set)
    for r in rows:
        _,key=code_key(r.get("shobi_code")); brand=clean(r.get("brand"))
        if key and brand: key_brands[key].add(brand)
    ambiguous={k:sorted(v) for k,v in key_brands.items() if len(v)>1}
    print(f"AMBIGUOUS_BRAND_KEYS={len(ambiguous)}")
    for k,brands in sorted(ambiguous.items()): print(f"AMBIGKEY\t{k}\t{' | '.join(brands)}")
    master_by_code={clean(r.get("shobi_code")):r for r in rows if clean(r.get("shobi_code"))}
    en_by_code={clean(r.get("shobi_code")):r for r in en_rows if clean(r.get("shobi_code"))}
    only_master=sorted(set(master_by_code)-set(en_by_code)); only_en=sorted(set(en_by_code)-set(master_by_code))
    print(f"ONLY_MASTER_CODES={len(only_master)}"); print(f"ONLY_EN_CODES={len(only_en)}")
    common=[f for f in fields if f in en_fields and f in {"shobi_code","brand","shobi_url"}]
    mismatches=[]
    for code in sorted(set(master_by_code)&set(en_by_code)):
        a,b=master_by_code[code],en_by_code[code]
        for f in common:
            if clean(a.get(f))!=clean(b.get(f)): mismatches.append((code,f,clean(a.get(f)),clean(b.get(f))))
    print(f"STRUCTURAL_MASTER_EN_MISMATCHES={len(mismatches)}")
    for item in mismatches[:300]: print("MISMATCH\t"+"\t".join(item))

if __name__ == "__main__":
    main()
# audit-refresh: post-ui-artifact-repair
