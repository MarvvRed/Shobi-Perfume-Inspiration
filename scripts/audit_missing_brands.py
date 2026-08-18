#!/usr/bin/env python3
import argparse
import csv
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "shobi-master.csv"
VERIFIED_KEYS = {
    "MIN":"Mind Games","LUS":"Lush","KYLJ":"Kylie Jenner","BORN":"BORNTOSTANDOUT",
    "GISS":"Gissah","ATEL":"Atelier Materi","RARB":"Rare Beauty","INI":"Initio Parfums Privés",
    "MOOD":"Mood London","OMA":"Omanluxury","ARM":"Armani","LES":"Les Liquides Imaginaires",
    "VIRT":"The 7 Virtues","BOYS":"Boy Smells","OBVI":"Obvious","NICO":"Nicolai Parfumeur Createur",
    "FRAG":"Fragrance Du Bois","KIL":"Kilian","KAJ":"Kajal","MIL":"Miller Harris",
    "SAB":"Sabrina Carpenter","NAV":"Navitus Parfums","BYRP":"Byron Parfums","ROOM":"Room 1015",
    "GRIT":"Gritti","CHAB":"Chabaud","FUGA":"Fugazzi","PAZZ":"Lorenzo Pazzaglia",
    "HARM":"The Harmonist","NES":"Nest","CHAR":"Charlotte Tilbury","ARMA":"Armaf",
    "GLO":"Glossier","ELIZ":"Elizabeth Arden","BAN":"Banana Republic","FRED":"Frederic Malle",
    "MIS":"Missguided",
}

def clean(v): return re.sub(r"\s+", " ", str(v or "")).strip()
def norm(v): return clean(v).casefold()
def code_key(code):
    m = re.match(r"^\s*\d+\s*-\s*([A-Z0-9]+)", clean(code).upper())
    return m.group(1) if m else ""

def infer(rows):
    existing = Counter(clean(r.get("brand")) for r in rows if clean(r.get("brand")))
    canonical = {norm(b): b for b in existing}
    key_to_brands, slug_to_brands = defaultdict(set), defaultdict(set)
    for r in rows:
        brand = clean(r.get("brand"))
        if not brand: continue
        k = code_key(r.get("shobi_code"))
        if k: key_to_brands[k].add(brand)
        for value in r.values():
            value = clean(value)
            if not value.startswith(("http://","https://")): continue
            u = urlparse(value); host = u.netloc.casefold(); path = [p for p in u.path.split("/") if p]
            lookup = None
            if "fragrantica" in host and len(path)>=2 and path[0].casefold()=="perfume": lookup=(host,path[1].casefold())
            elif "parfumo" in host and len(path)>=2 and path[0].casefold()=="perfumes": lookup=(host,path[1].casefold())
            elif "thescentbase" in host and len(path)>=3 and path[0].casefold() in {"it","en"} and path[1].casefold()=="perfumes": lookup=(host,path[2].casefold())
            if lookup: slug_to_brands[lookup].add(brand)

    fills, unresolved = {}, []
    for i,r in enumerate(rows):
        if clean(r.get("brand")): continue
        candidates = set()
        for field in ("inspired_by","shobi_name"):
            text=clean(r.get(field))
            if " - " in text:
                hit=canonical.get(norm(text.rsplit(" - ",1)[1]))
                if hit: candidates.add(hit)
        for value in r.values():
            value=clean(value)
            if not value.startswith(("http://","https://")): continue
            u=urlparse(value); host=u.netloc.casefold(); path=[p for p in u.path.split("/") if p]; lookup=None
            if "fragrantica" in host and len(path)>=2 and path[0].casefold()=="perfume": lookup=(host,path[1].casefold())
            elif "parfumo" in host and len(path)>=2 and path[0].casefold()=="perfumes": lookup=(host,path[1].casefold())
            elif "thescentbase" in host and len(path)>=3 and path[0].casefold() in {"it","en"} and path[1].casefold()=="perfumes": lookup=(host,path[2].casefold())
            if lookup and len(slug_to_brands.get(lookup,()))==1: candidates.add(next(iter(slug_to_brands[lookup])))
        k=code_key(r.get("shobi_code"))
        if k and len(key_to_brands.get(k,()))==1: candidates.add(next(iter(key_to_brands[k])))
        elif k in VERIFIED_KEYS: candidates.add(VERIFIED_KEYS[k])
        if len(candidates)==1: fills[i]=next(iter(candidates))
        else: unresolved.append((r.get("shobi_code",""), sorted(candidates)))
    return fills, unresolved

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--write", action="store_true"); args=ap.parse_args()
    with SOURCE.open("r",encoding="utf-8-sig",newline="") as fh:
        reader=csv.DictReader(fh); rows=list(reader); fields=reader.fieldnames
    if len(rows)!=2273 or not fields or "brand" not in fields: raise SystemExit("Safety stop: unexpected master structure")
    before=[dict(r) for r in rows]
    blank_before=sum(not clean(r.get("brand")) for r in rows)
    fills, unresolved=infer(rows)
    print(f"TOTAL_ROWS={len(rows)}"); print(f"BLANK_BRANDS_BEFORE={blank_before}"); print(f"SAFE_AUTO_FILL={len(fills)}"); print(f"UNRESOLVED={len(unresolved)}")
    if unresolved:
        for code,cands in unresolved: print(f"UNRESOLVED_CODE={code}\t{';'.join(cands)}")
        raise SystemExit("Safety stop: unresolved brands remain")
    if len(fills)!=blank_before: raise SystemExit("Safety stop: fill count does not equal blank count")
    for i,brand in fills.items(): rows[i]["brand"]=brand
    if sum(not clean(r.get("brand")) for r in rows)!=0: raise SystemExit("Safety stop: blank brands remain")
    for old,new in zip(before,rows):
        for field in fields:
            if field!="brand" and old.get(field)!=new.get(field): raise SystemExit(f"Safety stop: non-brand field changed: {field}")
        if clean(old.get("brand")) and old.get("brand")!=new.get("brand"): raise SystemExit("Safety stop: existing brand overwritten")
    if args.write:
        with SOURCE.open("w",encoding="utf-8-sig",newline="") as fh:
            writer=csv.DictWriter(fh,fieldnames=fields); writer.writeheader(); writer.writerows(rows)
        print("WRITE_OK=1")
    else: print("WRITE_OK=0")

if __name__=="__main__": main()
