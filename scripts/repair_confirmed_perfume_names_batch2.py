#!/usr/bin/env python3
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / "shobi-master.csv", ROOT / "shobi-master-en.csv"]
BAD = {"", "notes", "note", "of", "n/a", "na", "unknown", "-"}
CONFIRMED = {
    "2627-LTN N": "MÉTÉORE",
    "2011-LTN N": "DANS LA PEAU",
    "1997-LTN N": "ON THE BEACH",
    "1996-LTN N": "HEURES D'ABSENCE",
    "1768-LTN N": "CONTRE MOI",
    "1750-LTN N": "SUN SONG",
    "810-LTN N": "MATIÈRE NOIRE",
    "809-LTN N": "APOGÉE",
}

def clean(v): return re.sub(r"\s+", " ", str(v or "")).strip()
def suspicious(code,v):
    x=clean(v); return not x or x==clean(code) or x.casefold() in BAD

def repair(path):
    with path.open("r",encoding="utf-8-sig",newline="") as fh:
        rd=csv.DictReader(fh); fields=rd.fieldnames or []; rows=list(rd)
    if len(rows)!=2273: raise SystemExit(f"{path.name}: rows={len(rows)}")
    before=[dict(r) for r in rows]; changed=0; seen=set()
    for r in rows:
        code=clean(r.get("shobi_code"))
        if code not in CONFIRMED: continue
        seen.add(code); target=CONFIRMED[code]; touched=False
        for f in ("inspired_by","shobi_name"):
            if suspicious(code,r.get(f)):
                r[f]=target; touched=True
            elif clean(r.get(f)).casefold()!=target.casefold():
                raise SystemExit(f"{path.name}: conflict {code} {f}={r.get(f)!r}")
        if touched: changed+=1
    if seen!=set(CONFIRMED): raise SystemExit(f"{path.name}: missing={set(CONFIRMED)-seen}")
    for a,b in zip(before,rows):
        for f in fields:
            if f not in {"inspired_by","shobi_name"} and a.get(f,"")!=b.get(f,""):
                raise SystemExit(f"forbidden change {b.get('shobi_code')} {f}")
    tmp=path.with_suffix(path.suffix+".tmp")
    with tmp.open("w",encoding="utf-8-sig",newline="") as fh:
        wr=csv.DictWriter(fh,fieldnames=fields); wr.writeheader(); wr.writerows(rows)
    tmp.replace(path); return changed

def main():
    counts={p.name:repair(p) for p in FILES}
    if any(v!=len(CONFIRMED) for v in counts.values()): raise SystemExit(f"expected {len(CONFIRMED)} repairs: {counts}")
    print(counts)
if __name__=="__main__": main()
