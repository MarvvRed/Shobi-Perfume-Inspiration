#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'shobi-master.csv'
RANKING = ROOT / 'bestseller-ranking.js'
OUT = ROOT / 'Shobi Master Database' / 'bestseller-top100-enrichment.csv'

# Approved metadata already used by the existing Best Seller card renderers.
# main_notes are ordered display notes (not necessarily an olfactory pyramid).
APPROVED = {
    '305-KAY EL': ('winter', ['Brown Sugar','Tonka Bean','Amber','Amberwood','Vanilla Orchid'], 'https://www.fragrantica.com/perfume/Kayali-Fragrances/Vanilla-28-52616.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.52616.2x.avif'),
    '1508-KIL WP': ('winter', ['Cognac','Cinnamon','Vanilla','Praline','Tonka Bean'], 'https://www.fragrantica.com/perfume/By-Kilian/Angels-Share-62615.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.62615.2x.avif'),
    '451-BYR WP': ('spring', ['Aldehydes','Musk','Peony','Violet','African Orange Flower'], 'https://www.fragrantica.com/perfume/Byredo/Blanche-6686.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.6686.2x.avif'),
    '374-TMFO EL': ('winter', ['Tobacco Leaf','Vanilla','Spicy Notes','Dried Fruits','Cacao'], 'https://www.fragrantica.com/perfume/Tom-Ford/Tobacco-Vanille-1825.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.1825.2x.avif'),
    '1899-ZARK EL': ('spring', ['Cotton Flower','White Musk','White Oud'], 'https://www.fragrantica.com/perfume/ZARKOPERFUME/The-Muse-60665.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.60665.2x.avif'),
    '111-BAC N': ('winter', ['Amberwood','Saffron','Ambergris','Fir Resin','Cedar'], 'https://www.fragrantica.com/perfume/Maison-Francis-Kurkdjian/Baccarat-Rouge-540-33519.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.33519.2x.avif'),
    '220-CRD EL': ('summer', ['Coconut','Lime','White Rum','Sugar Cane','White Bergamot'], 'https://www.fragrantica.com/perfume/Creed/Virgin-Island-Water-899.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.899.2x.avif'),
    '350-TMFO EL': ('fall', ['Sour Cherry','Bitter Almond','Black Cherry','Vanilla','Tonka Bean'], 'https://www.fragrantica.com/perfume/Tom-Ford/Lost-Cherry-51411.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.51411.2x.avif'),
    '2216-DOL WP': ('fall', ['Candied Lemon','Vanilla','Panacotta','Orange Blossom','Rum'], 'https://www.fragrantica.com/perfume/Dolce-Gabbana/Devotion-84951.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.84951.2x.avif'),
    '2129-SOL EL': ('summer', ['Caramel','Vanilla','Pistachio','Almond','Salt'], 'https://www.fragrantica.com/perfume/Sol-de-Janeiro/Cheirosa-62-56062.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.56062.2x.avif'),
    '371-TMFO EL': ('summer', ['Pistachio','Bergamot','Cardamom','Pink Pepper','Tuberose'], 'https://www.fragrantica.com/perfume/Tom-Ford/Soleil-Blanc-34893.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.34893.2x.avif'),
    '449-BYR WP': ('spring', ['Bergamot','African Marigold','Buchu','Violet','Cyclamen'], 'https://www.fragrantica.com/perfume/Byredo/Bal-d-Afrique-6458.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.6458.2x.avif'),
    '204-CRD EL': ('spring', ['Bergamot','Black Currant','Apple','Lemon','Pink Pepper'], 'https://www.fragrantica.com/perfume/Creed/Aventus-9828.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.9828.2x.avif'),
    '765-KIL WP': ('winter', ['Neroli','Bergamot','Pink Pepper','Coriander','Orange Blossom'], 'https://www.fragrantica.com/perfume/By-Kilian/Love-4322.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.4322.2x.avif'),
    '994-ZAD WP': ('winter', ['Pink Pepper','Jasmine Sambac','Silkwood Blossom','Whipped Cream','Vanilla'], 'https://www.fragrantica.com/perfume/Zadig-Voltaire/This-is-Her-39358.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.39358.2x.avif'),
    '2371-MATIE EL': ('winter', ['Coconut Powder','Heliotrope','Madagascar Vanilla','Vanilla Absolute','White Musk'], 'https://www.fragrantica.com/perfume/Matiere-Premiere/Vanilla-Powder-84933.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.84933.2x.avif'),
    '2206-GIA LUX': ('winter', ['Caramel','Coumarin','Honey','Vanilla','White Musk'], 'https://www.fragrantica.com/perfume/Giardini-Di-Toscana/Bianco-Latte-64757.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.64757.2x.avif'),
    '179-XER N': ('fall', ['Lavender','Bergamot','Lemon','Honey','Cinnamon'], 'https://www.fragrantica.com/perfume/Xerjoff/XJ-1861-Naxos-30529.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.30529.2x.avif'),
    '229-DIP EL': ('summer', ['Fig Leaf','Fig','Green Notes','Coconut','Fig Tree'], 'https://www.fragrantica.com/perfume/Diptyque/Philosykos-Eau-de-Parfum-3865.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.3865.2x.avif'),
    '2162-BRB WP': ('fall', ['Vanilla','Lavender','Cacao','Ginger','Vanilla Caviar'], 'https://www.fragrantica.com/perfume/Burberry/Goddess-83483.html', 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.83483.2x.avif'),
}


def clean(v): return ' '.join(str(v or '').split()).strip()
def key(v): return re.sub(r'\s+', '', clean(v).upper())

def ranking():
    text=RANKING.read_text(encoding='utf-8')
    m=re.search(r'window\.SHOBI_BESTSELLER_RANKING=(\[.*?\]);',text,re.S)
    if not m: raise SystemExit('ranking parse failed')
    rows=json.loads(m.group(1))
    if len(rows)<100: raise SystemExit('ranking has fewer than 100 rows')
    return rows[:100]

def main():
    with MASTER.open('r',encoding='utf-8-sig',newline='') as f:
        rows=list(csv.DictReader(f))
    by_code={key(r.get('shobi_code')):r for r in rows if clean(r.get('shobi_code'))}
    existing={}
    if OUT.exists():
        with OUT.open('r',encoding='utf-8-sig',newline='') as f:
            for r in csv.DictReader(f):
                if clean(r.get('verified')) == '1': existing[key(r.get('shobi_code'))]=r
    out=[]
    for item in ranking():
        code=clean(item['code']); master=by_code.get(key(code))
        if not master: raise SystemExit(f'Top100 code missing from Master: {code}')
        approved=APPROVED.get(code)
        kept=existing.get(key(code)) if not approved else None
        if approved:
            season, notes, frag, image = approved
            source, verified = 'approved-existing-card', '1'
        elif kept:
            season=clean(kept.get('season')); notes=[x for x in clean(kept.get('main_notes')).split('|') if clean(x)]
            frag=clean(kept.get('fragrantica_url')); image=clean(kept.get('image'))
            source=clean(kept.get('source')) or 'verified-external'; verified='1'
        else:
            season=clean(master.get('season')); notes=[x for x in clean(master.get('notes')).split('|') if clean(x)]
            frag=clean(master.get('fragrantica_url')); image=clean(master.get('image'))
            source='pending-external-enrichment'; verified='0'
        out.append({
            'rank':item['rank'], 'prestashop_product_id':clean(master.get('prestashop_product_id')),
            'shobi_code':code, 'inspired_by':clean(master.get('inspired_by') or master.get('shobi_name')),
            'brand':clean(master.get('brand')), 'gender':clean(master.get('gender')),
            'season':season, 'main_notes':'|'.join(notes), 'fragrantica_url':frag, 'image':image,
            'source':source, 'verified':verified, 'note_count':len(notes),
        })
    OUT.parent.mkdir(parents=True,exist_ok=True)
    fields=list(out[0])
    with OUT.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(out)
    print(f'TOP100_ROWS={len(out)} VERIFIED={sum(int(r["verified"]) for r in out)} PENDING={sum(not int(r["verified"]) for r in out)}')

if __name__=='__main__': main()
