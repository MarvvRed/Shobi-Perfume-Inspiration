#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "shobi-master.csv"
RAW = ROOT / "shobi-best-sales-raw.csv"
OUTPUT = ROOT / "bestseller-ranking.js"

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

def main():
    master_codes = load_master_codes()
    with RAW.open("r", encoding="utf-8-sig", newline="") as fh:
        raw_rows = list(csv.DictReader(fh))
    if not raw_rows:
        raise SystemExit("Safety stop: raw Best Sales snapshot is empty")

    filtered = []
    skipped = []
    seen = set()
    last_global = 0
    for row in raw_rows:
        try:
            global_rank = int(clean(row.get("global_rank")))
        except ValueError:
            raise SystemExit(f"Invalid global_rank: {row.get('global_rank')}")
        if global_rank <= last_global:
            raise SystemExit("Safety stop: raw Best Sales ranks must be strictly increasing")
        last_global = global_rank
        code = norm_code(row.get("shobi_code"))
        if not code or code not in master_codes:
            skipped.append({"globalRank": global_rank, "code": code})
            continue
        if code in seen:
            continue
        seen.add(code)
        filtered.append({"rank": len(filtered) + 1, "globalRank": global_rank, "code": code})

    if len(filtered) < 100:
        raise SystemExit(f"Safety stop: only {len(filtered)} perfume Best Sellers remain after filtering; at least 100 are required")

    payload = json.dumps(filtered, ensure_ascii=False, separators=(",", ":"))
    OUTPUT.write_text(
        "// AUTO-GENERATED from shobi-best-sales-raw.csv filtered through shobi-master.csv.\n"
        "// rank = perfume-only rank shown on our site; globalRank = original Shobi Best Sales position.\n"
        f"window.SHOBI_BESTSELLER_RANKING={payload};\n"
        "window.SHOBI_BESTSELLER_CODES=window.SHOBI_BESTSELLER_RANKING.map(x=>x.code);\n"
        "window.SHOBI_BESTSELLER_RANK_BY_CODE=Object.fromEntries(window.SHOBI_BESTSELLER_RANKING.map(x=>[x.code,x.rank]));\n"
        "window.SHOBI_BESTSELLER_GLOBAL_RANK_BY_CODE=Object.fromEntries(window.SHOBI_BESTSELLER_RANKING.map(x=>[x.code,x.globalRank]));\n",
        encoding="utf-8",
    )

    print(f"RAW_BEST_SALES_ROWS={len(raw_rows)}")
    print(f"PERFUME_BEST_SELLERS={len(filtered)}")
    print(f"NON_PERFUME_OR_NOT_IN_MASTER_SKIPPED={len(skipped)}")
    print(f"SKIPPED_EXAMPLES={skipped[:20]}")
    print(f"OUTPUT={OUTPUT.name}")

if __name__ == "__main__":
    main()
