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


def explicit_candidate(desc):
    d = clean(desc)
    m = re.search(r"(?:From €\d+(?:\.\d+)?\s+)?([A-Z0-9][A-Z0-9 '&()./\-]{2,80}?)\s+-\s+[A-ZΑ-Ω][A-ZΑ-Ω '&()./\-]{2,80}(?:\.|\s+(?:Inspired|Similar|Clone|Type)|$)", d)
    if m:
        cand = clean(m.group(1))
        cand = re.sub(r"^\d{1,5}-[A-Z0-9]+(?:\s+[A-Z0-9]+)?\s+", "", cand).strip()
        cand = re.sub(r"^(?:AR|EL|WP|MP|LUX)\d+\s+(?:\d+\s+Reviews?\s+)?From €\d+(?:\.\d+)?\s+", "", cand, flags=re.I).strip()
        if cand and cand.casefold() not in BAD and not re.match(r"^\d+-", cand):
            return cand
    m = re.search(r"inspired by the notes\s+([^.;]+)", d, re.I)
    if m:
        cand = clean(m.group(1)).strip(" :-")
        if cand and cand.casefold() not in BAD:
            return cand
    return ""


def main():
    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    unresolved=[]
    proposed=[]
    for i,r in enumerate(rows,2):
        code=clean(r.get("shobi_code"))
        if suspicious(code,r.get("inspired_by")) and suspicious(code,r.get("shobi_name")):
            cand=explicit_candidate(r.get("description"))
            item=(i,code,clean(r.get("brand")),cand,clean(r.get("description")))
            unresolved.append(item)
            if cand: proposed.append(item)
    print(f"UNRESOLVED_NAME_ROWS={len(unresolved)}")
    print(f"EXPLICIT_OFFICIAL_CANDIDATES={len(proposed)}")
    print("--- CANDIDATES ---")
    for i,code,brand,cand,desc in proposed:
        print(f"CAND\t{i}\t{code}\t{brand}\t{cand}")
    print("--- STILL UNRESOLVED ---")
    for i,code,brand,cand,desc in unresolved:
        if not cand:
            print(f"MISS\t{i}\t{code}\t{brand}\t{desc[:220]}")

if __name__ == "__main__":
    main()
# audit-refresh: final-name-repair
