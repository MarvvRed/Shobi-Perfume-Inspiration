#!/usr/bin/env python3
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "shobi-master.csv"
EN = ROOT / "shobi-master-en.csv"
OUT = ROOT / "shobi-master-en.csv.tmp"


def load(path):
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        return reader.fieldnames or [], list(reader)


def main():
    mf, mr = load(MASTER)
    ef, er = load(EN)
    if mf != ef:
        raise SystemExit("column mismatch")
    if len(mr) != 2273 or len(er) != 2273:
        raise SystemExit(f"row count mismatch master={len(mr)} en={len(er)}")

    master = {r["shobi_code"].strip(): r for r in mr}
    en_codes = [r["shobi_code"].strip() for r in er]
    if set(master) != set(en_codes) or len(set(en_codes)) != len(en_codes):
        raise SystemExit("code set mismatch or duplicate codes")

    original = [dict(r) for r in er]
    changed = 0
    for r in er:
        code = r["shobi_code"].strip()
        want = master[code].get("brand", "").strip()
        if not want:
            raise SystemExit(f"master has blank brand for {code}")
        if r.get("brand", "").strip() != want:
            r["brand"] = want
            changed += 1

    if any(not r.get("brand", "").strip() for r in er):
        raise SystemExit("blank brand remains")

    for before, after in zip(original, er):
        for f in ef:
            if f == "brand":
                continue
            if before.get(f, "") != after.get(f, ""):
                raise SystemExit(f"non-brand field changed: {after.get('shobi_code')} {f}")

    with OUT.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=ef)
        writer.writeheader()
        writer.writerows(er)
    OUT.replace(EN)
    print(f"SYNCED_BRANDS={changed}")
    print("BLANK_BRANDS=0")
    print("ROWS=2273")


if __name__ == "__main__":
    main()
