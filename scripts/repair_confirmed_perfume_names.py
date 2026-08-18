#!/usr/bin/env python3
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / "shobi-master.csv", ROOT / "shobi-master-en.csv"]
BAD = {"", "notes", "note", "of", "n/a", "na", "unknown", "-"}

CONFIRMED = {
    "2466-ELIZ EL": "WHITE TEA EAU DE PARFUM",
    "2204-TMFO N": "SOLEIL DE FEU",
    "1841-BAN WP": "ROSEWOOD",
    "1824-VAR": "ARTISAN",
    "1104-DAV MP": "PURE PACIFIC",
    "1103-DAV MP": "HOT WATER",
    "848-NRO WP": "PURE MUSK FOR HER",
    "826-MIS WP": "BABE POWER",
    "592-ELIZ WP": "RED DOOR",
    "591-ELIZ WP": "GREEN TEA YUZU",
    "590-ELIZ WP": "AVENUE",
    "2723-LTN N": "RAPSODIA",
    "2647-LTN N": "SYMPHONY",
    "2645-LTN N": "eLVes",
    "2332-LTN N": "CITY OF STARS",
    "2320-LTN N": "IMAGINATION",
    "2201-LTN": "PACIFIC CHILL",
    "2109-LTN N": "CACTUS GARDEN",
    "132-LTN N": "OMBRE NOMADE",
}


def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def suspicious(code, value):
    v = clean(value)
    return not v or v == clean(code) or v.casefold() in BAD


def repair(path):
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        fields = reader.fieldnames or []
        rows = list(reader)
    if len(rows) != 2273:
        raise SystemExit(f"{path.name}: row count {len(rows)}")
    before = [dict(r) for r in rows]
    changed_rows = 0
    seen = set()
    for r in rows:
        code = clean(r.get("shobi_code"))
        if code not in CONFIRMED:
            continue
        seen.add(code)
        name = CONFIRMED[code]
        changed = False
        if suspicious(code, r.get("inspired_by")):
            r["inspired_by"] = name
            changed = True
        elif clean(r.get("inspired_by")) != name:
            raise SystemExit(f"{path.name}: conflicting inspired_by for {code}: {r.get('inspired_by')!r}")
        if suspicious(code, r.get("shobi_name")):
            r["shobi_name"] = name
            changed = True
        elif clean(r.get("shobi_name")) != name:
            raise SystemExit(f"{path.name}: conflicting shobi_name for {code}: {r.get('shobi_name')!r}")
        if changed:
            changed_rows += 1
    missing = set(CONFIRMED) - seen
    if missing:
        raise SystemExit(f"{path.name}: missing codes {sorted(missing)}")
    for old, new in zip(before, rows):
        for f in fields:
            if f in {"inspired_by", "shobi_name"}:
                continue
            if old.get(f, "") != new.get(f, ""):
                raise SystemExit(f"{path.name}: forbidden change {new.get('shobi_code')} {f}")
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
    tmp.replace(path)
    return changed_rows


def main():
    counts = {p.name: repair(p) for p in FILES}
    if any(v != len(CONFIRMED) for v in counts.values()):
        raise SystemExit(f"expected {len(CONFIRMED)} changed rows per file; got {counts}")
    print(f"CONFIRMED_MAPPINGS={len(CONFIRMED)}")
    print(counts)

if __name__ == "__main__":
    main()
