#!/usr/bin/env python3
import csv
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MASTER_DIR = ROOT / "Shobi Master Database"
BASELINE = MASTER_DIR / "shobi-master-v1.csv"
CURRENT = MASTER_DIR / "shobi-master-current.csv"
CANDIDATE = MASTER_DIR / "shobi-master-candidate.csv"
REPORT_JSON = MASTER_DIR / "latest-sync-report.json"
REPORT_CSV = MASTER_DIR / "latest-sync-changes.csv"
BASE = "https://leparfum.com.gr"
SHOW_ALL_URL = BASE + "/en/perfumes?resultsPerPage=99999"
SHOBI_CATEGORY_URL = BASE + "/el/shobi?resultsPerPage=99999"
RULE = "Choose+Bottle+Extra Essence"
SECONDARY_RULE = "prestashop_product_id present in /el/shobi"
FIELDS = ["prestashop_product_id","shobi_code","shobi_name","reference","reference_prefix","inspired_by","category","price_from_eur","official_description","url","first_seen","last_seen","status","classification_rule","source"]


def clean(v): return re.sub(r"\s+", " ", str(v or "")).strip()

def extract_inspired(desc):
    desc = clean(desc)
    for pat in [r"Inspired by the fragrance notes of\s+(.+?)(?:\.|$)",r"Inspired by the fragrance of\s+(.+?)(?:\.|$)",r"Inspired by\s+(.+?)(?:\.|$)",r"Ιnspired by the fragrance notes of\s+(.+?)(?:\.|$)",r"Ιnspired by\s+(.+?)(?:\.|$)"]:
        m = re.search(pat, desc, re.I)
        if m: return clean(m.group(1)).strip(" :-")
    return ""

def extract_code(name, desc):
    for value in (name, desc):
        m = re.match(r"^\s*(\d{2,5}-[A-Za-z0-9]+)", value or "")
        if m: return m.group(1)
    return ""

def price_value(text):
    m = re.search(r"(\d+(?:[\.,]\d+)?)", clean(text))
    return m.group(1).replace(",", ".") if m else ""

def normalize_compare(field, value):
    value = clean(value)
    if field == "price_from_eur" and value:
        try: return f"{float(value.replace(',', '.')):.6f}"
        except ValueError: pass
    return value

def load_csv(path):
    with path.open("r", encoding="utf-8-sig", newline="") as f: return list(csv.DictReader(f))

def write_csv(path, rows, fields=FIELDS):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)

def is_shobi_card(card):
    for a in card.select("a[href]"):
        h=(a.get("href") or "").lower()
        if "choose-" in h and "bottle-" in h and "extra_essence-" in h: return a.get("href") or ""
    return ""

def parse_page(html):
    soup=BeautifulSoup(html,"html.parser"); all_cards=soup.select("article.product-miniature[data-id-product]"); rows=[]
    for card in all_cards:
        signature_href=is_shobi_card(card)
        if not signature_href: continue
        pid=clean(card.get("data-id-product")); title_node=card.select_one(".product-title"); ref_node=card.select_one(".product-reference"); category_node=card.select_one(".product-category-name"); desc_node=card.select_one(".product-description-short"); price_node=card.select_one(".product-price")
        title=clean(title_node.get_text(" ",strip=True) if title_node else ""); reference=clean(ref_node.get_text(" ",strip=True) if ref_node else ""); category=clean(category_node.get_text(" ",strip=True) if category_node else ""); desc=clean(desc_node.get_text(" ",strip=True) if desc_node else ""); price=price_value(price_node.get_text(" ",strip=True) if price_node else ""); url=urljoin(BASE,signature_href.split("#",1)[0]); pm=re.match(r"^[A-Za-z]+",reference)
        rows.append({"prestashop_product_id":pid,"shobi_code":extract_code(title,desc),"shobi_name":title,"reference":reference,"reference_prefix":pm.group(0).upper() if pm else "","inspired_by":extract_inspired(desc),"category":category,"price_from_eur":price,"official_description":desc,"url":url})
    return rows,len(all_cards),soup

def parse_category_ids(html):
    soup=BeautifulSoup(html,"html.parser")
    cards=soup.select("article.product-miniature[data-id-product]")
    ids=[clean(card.get("data-id-product")) for card in cards]
    return ids,len(cards)

def browser_navigate(page,url,min_cards,label):
    print(f"BROWSER_NAVIGATE label={label} url={url}")
    page.goto(url,wait_until="domcontentloaded",timeout=120000)
    for i in range(12):
        title=page.title(); final_url=page.url
        cards=page.locator("article.product-miniature[data-id-product]").count()
        print(f"BROWSER_WAIT label={label} step={i} title={title!r} url={final_url} cards={cards}")
        if cards >= min_cards: break
        page.wait_for_timeout(5000)
    html=page.content(); final_url=page.url; final_title=page.title()
    if "__browser-challenge" in final_url or final_title.lower()=="browser verification":
        raise SystemExit(f"Safety stop: Shobi browser verification did not grant normal automated browser access for {label}")
    return html,final_url,final_title

def fetch_catalog():
    # Use one standard, non-stealth Chromium session for both official signals.
    # Primary signal: /en/perfumes + Choose/Bottle/Extra Essence signature.
    # Secondary independent signal: membership of the same product ID in /el/shobi.
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=False)
        context=browser.new_context(locale="en-US")
        page=context.new_page()

        html,final_url,final_title=browser_navigate(page,SHOW_ALL_URL,2400,"perfumes")
        rows,cards,_=parse_page(html)
        print(f"SHOW_ALL title={final_title!r} url={final_url} cards={cards} shobi={len(rows)}")
        if cards==0:
            browser.close()
            raise SystemExit("Safety stop: no product cards detected on /en/perfumes")

        category_html,category_final_url,category_final_title=browser_navigate(page,SHOBI_CATEGORY_URL,3000,"shobi-category")
        category_ids,category_cards=parse_category_ids(category_html)
        print(f"SHOBI_CATEGORY title={category_final_title!r} url={category_final_url} cards={category_cards} unique_ids={len(set(category_ids))}")
        browser.close()

    return rows,cards,category_ids,category_cards

def merge_live_with_history(live_rows,old_rows):
    today=date.today().isoformat(); old={r["prestashop_product_id"]:r for r in old_rows}; merged=[]
    for live in live_rows:
        prev=old.get(live["prestashop_product_id"]); row={k:"" for k in FIELDS}
        if prev: row.update(prev)
        for k,v in live.items():
            if v!="" or not prev: row[k]=v
        row["first_seen"]=prev.get("first_seen",today) if prev else today; row["last_seen"]=today; row["status"]="ACTIVE"; row["classification_rule"]=RULE; row["source"]="SHOBI_LIVE_SHOW_ALL"
        merged.append(row)
    return merged

def changed_fields(a,b):
    ignore={"last_seen","source"}
    return [k for k in FIELDS if k not in ignore and normalize_compare(k,a.get(k))!=normalize_compare(k,b.get(k))]

def main():
    old_path=CURRENT if CURRENT.exists() else BASELINE
    if not old_path.exists(): raise SystemExit("Safety stop: no official Shobi Master baseline found")
    old_rows=load_csv(old_path); old_by_id={r["prestashop_product_id"]:r for r in old_rows}; print(f"BASELINE file={old_path.name} rows={len(old_rows)}")
    raw_live,total_cards,category_ids,category_cards=fetch_catalog(); ids=[r["prestashop_product_id"] for r in raw_live]; print(f"VALIDATE total_cards={total_cards} shobi={len(raw_live)} unique_ids={len(set(ids))}")
    if any(not x for x in ids): raise SystemExit("Safety stop: live Shobi product missing prestashop_product_id")
    if len(ids)!=len(set(ids)): raise SystemExit("Safety stop: duplicate prestashop_product_id in live Shobi catalog")
    if len(raw_live)<2200: raise SystemExit(f"Safety stop: only {len(raw_live)} Shobi perfumes detected")
    if total_cards<2400: raise SystemExit(f"Safety stop: only {total_cards} total Perfumes cards detected")
    if abs(len(raw_live)-len(old_rows))>max(300,int(len(old_rows)*0.12)): raise SystemExit(f"Safety stop: suspicious catalog-size jump old={len(old_rows)} live={len(raw_live)}")

    if any(not x for x in category_ids): raise SystemExit("Safety stop: /el/shobi product missing prestashop_product_id")
    if len(category_ids)!=len(set(category_ids)): raise SystemExit("Safety stop: duplicate prestashop_product_id in /el/shobi")
    if category_cards<3000: raise SystemExit(f"Safety stop: only {category_cards} products detected in /el/shobi")
    category_id_set=set(category_ids); live_id_set=set(ids); missing_from_category=sorted(live_id_set-category_id_set,key=lambda x:int(x) if x.isdigit() else x)
    if missing_from_category:
        sample=",".join(missing_from_category[:20])
        raise SystemExit(f"Safety stop: {len(missing_from_category)} signature-certified Shobi perfumes are absent from /el/shobi; sample={sample}")
    category_extra=len(category_id_set-live_id_set)
    print(f"CROSSCHECK rule={SECONDARY_RULE!r} category={len(category_id_set)} perfumes={len(live_id_set)} missing=0 category_extra={category_extra}")

    merged=merge_live_with_history(raw_live,old_rows); live_by_id={r["prestashop_product_id"]:r for r in merged}; old_ids,live_ids=set(old_by_id),set(live_by_id)
    new_ids=sorted(live_ids-old_ids,key=lambda x:int(x) if x.isdigit() else x); removed_ids=sorted(old_ids-live_ids,key=lambda x:int(x) if x.isdigit() else x); modified=[]
    for pid in sorted(old_ids&live_ids,key=lambda x:int(x) if x.isdigit() else x):
        fields=changed_fields(old_by_id[pid],live_by_id[pid])
        if fields: modified.append((pid,fields))
    changes=[]
    for pid in new_ids:
        r=live_by_id[pid]; changes.append({"change":"NEW","prestashop_product_id":pid,"shobi_name":r["shobi_name"],"reference":r["reference"],"fields":""})
    for pid,fields in modified:
        r=live_by_id[pid]; changes.append({"change":"MODIFIED","prestashop_product_id":pid,"shobi_name":r["shobi_name"],"reference":r["reference"],"fields":"|".join(fields)})
    for pid in removed_ids:
        r=old_by_id[pid]; changes.append({"change":"REMOVED","prestashop_product_id":pid,"shobi_name":r["shobi_name"],"reference":r["reference"],"fields":""})
    write_csv(CANDIDATE,merged); write_csv(REPORT_CSV,changes,["change","prestashop_product_id","shobi_name","reference","fields"])
    report={"date":date.today().isoformat(),"baseline_file":old_path.name,"source_url":SHOW_ALL_URL,"secondary_source_url":SHOBI_CATEGORY_URL,"total_perfumes_cards":total_cards,"shobi_perfumes":len(merged),"shobi_category_products":len(category_id_set),"shobi_category_extra_products":category_extra,"shobi_category_missing_perfumes":0,"new":len(new_ids),"modified":len(modified),"removed":len(removed_ids),"changed":bool(changes),"classification_rule":RULE,"secondary_validation_rule":SECONDARY_RULE,"primary_key":"prestashop_product_id","safety":"PASS"}
    REPORT_JSON.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf-8"); print(json.dumps(report,indent=2))

if __name__=="__main__": main()
