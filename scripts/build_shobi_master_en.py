#!/usr/bin/env python3
import csv
import re
import time
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "shobi-master.csv"
OUTPUT = ROOT / "shobi-master-en.csv"
BASE = "https://leparfum.com.gr"
LIST_URL = BASE + "/en/perfumes?page={page}"

CODE_RE = re.compile(r"^\s*(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-ZΑ-Ω0-9]+))?\b", re.I)
GREEK_RE = re.compile(r"[\u0370-\u03ff\u1f00-\u1fff]")
BAD_NAMES = {"", "notes", "note", "of", "the fragrance notes", "the fragrance notes of", "n/a", "na", "unknown", "-"}
CODE_ALIASES = {"1685-FRED N":"1685-FRE N","1068-CHA":"1068-CHA M","1930-VIC":"1930-VIC M","1156-HER":"1156-HER M","1065-CHA":"1065-CHA M"}

def clean(text): return re.sub(r"\s+", " ", str(text or "")).strip()
def valid_name(value, code=""):
    value=clean(value); return bool(value) and value.casefold() not in BAD_NAMES and value != clean(code)
def safe_english(value):
    value=clean(value); return value if value and not GREEK_RE.search(value) else ""
def is_english_url(url):
    try:
        p=urlparse(str(url or "")); return p.netloc.lower()=="leparfum.com.gr" and p.path.startswith("/en/")
    except Exception: return False
def extract_inspired(desc):
    desc=clean(desc)
    for pattern in [r"\bInspired by the fragrance notes of\s+(.+?)(?:\.|$)",r"\bInspired by the notes of\s+(.+?)(?:\.|$)",r"\bInspired by the notes\s+(.+?)(?:\.|$)",r"\bInspired by the fragrance\s+(.+?)(?:\.|$)",r"\bInspired by\s+(.+?)(?:\.|$)",r"\bby the fragrance notes of\s+(.+?)(?:\.|$)"]:
        m=re.search(pattern,desc,re.I)
        if m:
            c=clean(m.group(1)).strip(" :-")
            if valid_name(c) and not GREEK_RE.search(c): return c
    return ""
def raw_code(value): return clean(value).upper().replace("Ν","N")
def norm_code(value):
    value=raw_code(value); m=re.match(r"^(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-Z0-9]+))?",value)
    if not m:return value
    code=f"{m.group(1)}-{m.group(2)}"+(f" {m.group(3)}" if m.group(3) else "")
    return CODE_ALIASES.get(code,code)
def base_code(value):
    code=norm_code(value); m=re.match(r"^(\d{1,5}-[A-Z0-9]+)",code); return m.group(1) if m else code
def fetch_page(session,page):
    r=session.get(LIST_URL.format(page=page),timeout=30,allow_redirects=True); r.raise_for_status()
    if not is_english_url(r.url): raise SystemExit(f"Safety stop: English catalog request redirected outside /en/: {r.url}")
    return r.text
def parse_products(html):
    soup=BeautifulSoup(html,"html.parser"); products=[]
    for card in soup.select("article.product-miniature"):
        title_el=card.select_one("h2.product-title a, .product-title a")
        if not title_el:continue
        title=clean(title_el.get_text(" ",strip=True)); m=CODE_RE.search(title)
        if not m:continue
        source_code=f"{m.group(1)}-{m.group(2)}"+(f" {m.group(3)}" if m.group(3) else ""); code=norm_code(source_code)
        href=urljoin(BASE,title_el.get("href") or "")
        if not is_english_url(href):continue
        desc_el=card.select_one(".product-description-short, .product-description, .product-desc")
        raw_desc=clean(desc_el.get_text(" ",strip=True)) if desc_el else ""; raw_tail=clean(title[m.end():]).strip(" -–—:|")
        desc=safe_english(raw_desc); tail=safe_english(raw_tail); text=clean(card.get_text(" ",strip=True))
        products.append({"code":code,"base":base_code(code),"url":href,"description":desc,"inspired_by":extract_inspired(desc),"title_tail":tail,"status":"IN_STOCK" if re.search(r"\bIn Stock\b",text,re.I) else "","had_greek_fields":bool(GREEK_RE.search(raw_desc) or GREEK_RE.search(raw_tail))})
    return products,soup
def apply_product(row,p):
    if p["url"]:row["shobi_url"]=p["url"]
    if p["description"]:row["description"]=p["description"]
    if p["inspired_by"] and valid_name(p["inspired_by"],row.get("shobi_code")):row["inspired_by"]=p["inspired_by"];row["shobi_name"]=p["inspired_by"]
    elif p["title_tail"] and valid_name(p["title_tail"],row.get("shobi_code")):
        if not valid_name(row.get("shobi_name"),row.get("shobi_code")):row["shobi_name"]=p["title_tail"]
        if not valid_name(row.get("inspired_by"),row.get("shobi_code")):row["inspired_by"]=p["title_tail"]
    if p["status"]:row["status"]=p["status"]
def new_row(fields,p):
    name=p["inspired_by"] or p["title_tail"]
    if not valid_name(name,p["code"]):return None
    row={f:"" for f in fields};row.update({"shobi_code":p["code"],"shobi_name":name,"inspired_by":name,"shobi_url":p["url"],"description":p["description"],"status":p["status"]})
    if "new" in row:row["new"]="1"
    return row
def main():
    with SOURCE.open("r",encoding="utf-8-sig",newline="") as fh:
        reader=csv.DictReader(fh);rows=list(reader);fields=reader.fieldnames
    if not fields or "shobi_code" not in fields:raise SystemExit("Invalid shobi-master.csv: missing header/shobi_code")
    starting_count=len(rows)
    if starting_count<2200:raise SystemExit(f"Safety stop: master unexpectedly small ({starting_count} rows)")
    # Existing master is our trusted fallback. Greek legacy fields are preserved, never promoted as English.
    legacy_greek_names=sum(bool(GREEK_RE.search(str(r.get("shobi_name", "")))) or bool(GREEK_RE.search(str(r.get("inspired_by", "")))) for r in rows)
    legacy_greek_desc=sum(bool(GREEK_RE.search(str(r.get("description", "")))) for r in rows)
    session=requests.Session();session.headers.update({"User-Agent":"Mozilla/5.0 ShobiDatabaseUpdater/2.3"})
    official_products=[];page=1;filtered_fields=0
    while page<=250:
        products,soup=parse_products(fetch_page(session,page)); bad=[p["code"] for p in products if p["had_greek_fields"]];filtered_fields+=len(bad)
        if bad:print(f"PAGE_{page}_GREEK_FIELDS_IGNORED={len(bad)} examples={bad[:8]}")
        if not products:
            if page==1:raise SystemExit("English Shobi page parser found no products")
            break
        official_products.extend(products);next_link=soup.select_one("a.next, .pagination .next a, a[rel='next']")
        if not next_link:
            nums=[int(clean(a.get_text())) for a in soup.select(".pagination a") if clean(a.get_text()).isdigit()]
            if not nums or page>=max(nums):break
        page+=1;time.sleep(.15)
    exact={p["code"]:p for p in official_products};official_products=list(exact.values());bybase=defaultdict(list)
    for p in official_products:bybase[p["base"]].append(p)
    if len(official_products)<2000:raise SystemExit(f"Safety stop: English catalog unexpectedly small ({len(official_products)} unique products)")
    basecounts=Counter(base_code(r.get("shobi_code")) for r in rows if r.get("shobi_code"));matched=0;unmatched=[];existing={norm_code(r.get("shobi_code")):r for r in rows if r.get("shobi_code")}
    for row in rows:
        source=raw_code(row.get("shobi_code"));code=norm_code(source);p=None
        if source in {"390-ACQ WP","390-ACQ MP"}:
            wanted="/fragrances-for-women/" if source.endswith(" WP") else "/fragrances-for-men/";p=next((x for x in bybase.get("390-ACQ",[]) if wanted in x["url"]),None)
        else:p=exact.get(code)
        if p is None:
            candidates=bybase.get(base_code(code),[])
            if basecounts[base_code(code)]==1 and len(candidates)==1:p=candidates[0]
        if p is None:unmatched.append(row.get("shobi_code"));continue
        apply_product(row,p);matched+=1
    added=[];skipped=[]
    for p in official_products:
        if p["code"] in existing:continue
        row=new_row(fields,p)
        if row is None:skipped.append(p["code"]);continue
        rows.append(row);existing[p["code"]]=row;added.append(p["code"])
    min_matches=max(2100,int(starting_count*.90))
    if matched<min_matches:raise SystemExit(f"Safety stop: only {matched}/{starting_count} existing rows matched English Shobi")
    if len(rows)<starting_count:raise SystemExit("Safety stop: row count decreased")
    if len(added)>300:raise SystemExit(f"Safety stop: suspiciously large addition ({len(added)} new codes)")
    # Critical rule: the sync may not INTRODUCE additional Greek display data. Existing legacy Greek is tolerated until separately cleaned.
    final_greek_names=sum(bool(GREEK_RE.search(str(r.get("shobi_name", "")))) or bool(GREEK_RE.search(str(r.get("inspired_by", "")))) for r in rows)
    final_greek_desc=sum(bool(GREEK_RE.search(str(r.get("description", "")))) for r in rows)
    if final_greek_names>legacy_greek_names or final_greek_desc>legacy_greek_desc:raise SystemExit("Safety stop: sync introduced new Greek display data")
    with OUTPUT.open("w",encoding="utf-8-sig",newline="") as fh:
        w=csv.DictWriter(fh,fieldnames=fields);w.writeheader();w.writerows(rows)
    print(f"MASTER_ROWS_BEFORE={starting_count}");print(f"OFFICIAL_EN_PRODUCTS={len(official_products)}");print(f"MATCHED_EXISTING_ROWS={matched}");print(f"UNMATCHED_EXISTING_ROWS={len(unmatched)}");print(f"NEW_ROWS_ADDED={len(added)}");print(f"NEW_ROWS_SKIPPED_NO_ENGLISH_NAME={len(skipped)}");print(f"LEGACY_GREEK_NAMES_PRESERVED={legacy_greek_names}");print(f"LEGACY_GREEK_DESCRIPTIONS_PRESERVED={legacy_greek_desc}");print(f"SOURCE_GREEK_FIELDS_IGNORED={filtered_fields}");print(f"MASTER_ROWS_AFTER={len(rows)}");print("SOURCE_LANGUAGE=ENGLISH_ROUTE_SAFE_FIELDS_ONLY");print(f"OUTPUT={OUTPUT.name}")
if __name__=="__main__":main()
