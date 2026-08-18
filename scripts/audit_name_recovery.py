#!/usr/bin/env python3
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "shobi-master.csv"

BAD = {"", "notes", "note", "of", "n/a", "na", "unknown", "-"}


def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def suspicious(code, value):
    v = clean(value)
    return not v or v == clean(code) or v.casefold() in BAD


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    unresolved=[]
    for i,r in enumerate(rows,2):
        code=clean(r.get("shobi_code"))
        if suspicious(code,r.get("inspired_by")) and suspicious(code,r.get("shobi_name")):
            unresolved.append((i,code,clean(r.get("brand")),clean(r.get("inspired_by")),clean(r.get("shobi_name")),clean(r.get("shobi_url")),clean(r.get("description"))))
    print(f"UNRESOLVED_NAME_ROWS={len(unresolved)}")
    for item in unresolved:
        print("ROW\t" + "\t".join(map(str,item)))

if __name__ == "__main__":
    main()
