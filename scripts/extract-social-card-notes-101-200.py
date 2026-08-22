#!/usr/bin/env python3
import json, re, subprocess, tempfile, difflib
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance

ROOT=Path(__file__).resolve().parents[1]
IMG_DIR=ROOT/'artifacts'/'fragrantica-social-cards-101-200'
MANIFEST=ROOT/'Personal Database'/'bestseller-101-200-social-card-manifest.json'
OUT=ROOT/'Personal Database'/'bestseller-101-200-social-card-notes-ocr.json'
VOCAB=ROOT/'Personal Database'/'fragrantica-note-vocabulary.txt'

CELLS=[
    (64,888,184,956),(184,888,304,956),(304,888,430,956),
    (64,1024,184,1100),(184,1024,304,1100),(304,1024,430,1100),
]

def clean_text(s):
    s=s.replace('\n',' ').replace('\r',' ')
    s=re.sub(r"[^A-Za-z0-9À-ÿ&()\-'’., ]+",' ',s)
    return re.sub(r'\s+',' ',s).strip(' .,-')

def key(s):
    s=s.lower().replace('’',"'")
    s=re.sub(r'[^a-z0-9]+','',s)
    return s

def load_vocab():
    # Seeded with canonical Fragrantica labels seen in our social cards. The file can grow independently.
    seed='''Amber
Ambergris
Ambrette (Musk Mallow)
Ambrofix
Agarwood (Oud)
Aloe Vera
Bergamot
Black Currant
Blood Orange
Cardamom
Cashmir Wood
Cedar
Chamomile
Coconut
Cognac
Cream
Ginger
Grapefruit
Green Notes
Incense
Iris
Jasmine
Lavender
Lemon
Lily-of-the-Valley
Marshmallow
Myrrh
Orange
Orange Blossom
Palisander Rosewood
Patchouli
Peach
Pepper
Pineapple
Praline
Rose
Rum
Sage
Salt
Sandalwood
Seaweed
Strawberry
Sugar
Tonka Bean
Vanilla
Vetiver
Violet Leaf'''.splitlines()
    vals=[x.strip() for x in seed if x.strip()]
    if VOCAB.exists(): vals += [x.strip() for x in VOCAB.read_text(encoding='utf-8').splitlines() if x.strip()]
    # stable unique list
    return list(dict.fromkeys(vals))

def normalize(raw,vocab):
    rk=key(raw)
    if not rk: return raw,0.0
    best=None; score=0.0
    for v in vocab:
        vk=key(v)
        s=difflib.SequenceMatcher(None,rk,vk).ratio()
        # OCR often leaves icon/noise prefixes or suffixes; reward containment strongly.
        if vk and (vk in rk or rk in vk): s=max(s, min(len(vk),len(rk))/max(len(vk),len(rk))*0.25+0.72)
        if s>score: best,score=v,s
    return (best if score>=0.70 else raw),round(score*100,1)

def ocr_crop(img,box):
    crop=ImageEnhance.Contrast(ImageOps.autocontrast(img.crop(box).convert('L'))).enhance(1.8)
    crop=crop.resize((crop.width*4,crop.height*4))
    with tempfile.NamedTemporaryFile(suffix='.png',delete=False) as f: tmp=Path(f.name)
    crop.save(tmp)
    try:
        p=subprocess.run(['tesseract',str(tmp),'stdout','--psm','6','-l','eng','tsv'],capture_output=True,text=True)
        rows=[]
        for line in p.stdout.splitlines()[1:]:
            z=line.split('\t')
            if len(z)<12: continue
            try: c=float(z[10])
            except: continue
            if z[11].strip() and c>=0: rows.append((z[11].strip(),c))
        return clean_text(' '.join(t for t,_ in rows)), round(sum(c for _,c in rows)/len(rows),1) if rows else 0
    finally: tmp.unlink(missing_ok=True)

def main():
    vocab=load_vocab(); manifest=json.loads(MANIFEST.read_text(encoding='utf-8')); results=[]
    for rec in sorted(manifest,key=lambda x:int(x['rank'])):
        rank=int(rec['rank']); fid=int(rec['fragrantica_id']); path=IMG_DIR/f'{rank:03d}-{fid}.jpeg'
        if not path.exists(): results.append({**rec,'status':'missing-image','notes':[]}); continue
        img=Image.open(path); notes=[]
        for i,box in enumerate(CELLS,1):
            raw,ocr=ocr_crop(img,box)
            if not raw: continue
            canonical,match=normalize(raw,vocab)
            notes.append({'position':i,'text':canonical,'raw_ocr':raw,'ocr_confidence':ocr,'vocab_match':match})
        min_match=min((n['vocab_match'] for n in notes),default=0)
        status='verified' if notes and min_match>=82 else 'review'
        results.append({'rank':rank,'code':rec.get('code',''),'inspired_by':rec.get('inspired_by',''),'brand':rec.get('brand',''),'fragrantica_id':fid,'fragrantica_url':rec.get('fragrantica_url',''),'status':status,'note_count':len(notes),'min_vocab_match':min_match,'notes':notes})
        print(f'#{rank} {status} match={min_match:.1f} :: '+' | '.join(n['text'] for n in notes))
    summary={'count':len(results),'verified_count':sum(r['status']=='verified' for r in results),'review_count':sum(r['status']=='review' for r in results),'missing_image_count':sum(r['status']=='missing-image' for r in results),'pending_rank':149,'vocabulary_size':len(vocab),'rows':results}
    OUT.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('VERIFIED_COUNT',summary['verified_count']); print('REVIEW_COUNT',summary['review_count'])
if __name__=='__main__': main()
