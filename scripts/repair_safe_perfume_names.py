#!/usr/bin/env python3
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / "shobi-master.csv", ROOT / "shobi-master-en.csv"]
BAD = {"", "notes", "note", "of", "n/a", "na", "unknown", "-"}


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
        raise SystemExit(f"{path.name}: unexpected row count {len(rows)}")
    before = [dict(r) for r in rows]
    changed = 0
    for r in rows:
        code = clean(r.get("shobi_code"))
        insp = clean(r.get("inspired_by"))
        name = clean(r.get("shobi_name"))
        if not suspicious(code, insp) and suspicious(code, name):
            r["shobi_name"] = insp
            changed += 1
    for old, new in zip(before, rows):
        for f in fields:
            if f == "shobi_name":
                continue
            if old.get(f, "") != new.get(f, ""):
                raise SystemExit(f"{path.name}: forbidden change {new.get('shobi_code')} {f}")
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
    tmp.replace(path)
    return changed


def main():
    counts = {p.name: repair(p) for p in FILES}
    if counts["shobi-master.csv"] != 222 or counts["shobi-master-en.csv"] != 222:
        raise SystemExit(f"safety stop: expected 222 safe repairs per file, got {counts}")
    print(counts)

if __name__ == "__main__":
    main()
