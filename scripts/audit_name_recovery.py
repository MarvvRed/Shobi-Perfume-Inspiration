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


def candidates(desc):
    desc = clean(desc)
    patterns = [
        r"Inspired by(?: the)?(?: fragrance)?(?: notes)?(?: of)?\s*[:\-]?\s*([^.;|]+)",
        r"inspired by\s*[:\-]?\s*([^.;|]+)",
        r"similar to\s*[:\-]?\s*([^.;|]+)",
        r"type of\s*[:\-]?\s*([^.;|]+)",
    ]
    out = []
    for p in patterns:
        for m in re.finditer(p, desc, re.I):
            value = clean(m.group(1))
            if value and value.casefold() not in BAD and len(value) > 2:
                out.append(value)
    seen=[]
    for v in out:
        if v.casefold() not in {x.casefold() for x in seen}:
            seen.append(v)
    return seen[:5]


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    bad=[]
    recovered=0
    good_insp_bad_name=0
    bad_insp_good_name=0
    both_bad=0
    for i,r in enumerate(rows,2):
        code=clean(r.get("shobi_code"))
        insp_bad=suspicious(code,r.get("inspired_by"))
        name_bad=suspicious(code,r.get("shobi_name"))
        if insp_bad or name_bad:
            if not insp_bad and name_bad:
                good_insp_bad_name += 1
            elif insp_bad and not name_bad:
                bad_insp_good_name += 1
            else:
                both_bad += 1
            cands=candidates(r.get("description"))
            if len(cands)==1:
                recovered += 1
            bad.append((i,code,clean(r.get("brand")),clean(r.get("inspired_by")),clean(r.get("shobi_name")),cands,clean(r.get("description"))))
    print(f"SUSPICIOUS_ROWS={len(bad)}")
    print(f"GOOD_INSPIRED_BAD_NAME={good_insp_bad_name}")
    print(f"BAD_INSPIRED_GOOD_NAME={bad_insp_good_name}")
    print(f"BOTH_BAD={both_bad}")
    print(f"SINGLE_DESCRIPTION_CANDIDATE={recovered}")
    for i,code,brand,insp,name,cands,desc in bad:
        print("ROW\t%s\t%s\t%s\t%s\t%s\t%s\t%s" % (i,code,brand,insp,name," || ".join(cands),desc))

if __name__ == "__main__":
    main()
