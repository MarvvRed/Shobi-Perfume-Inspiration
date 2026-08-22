#!/usr/bin/env python3
# Canonical clean Top100 missing-note completion.
import json, re, subprocess, tempfile, difflib, time
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image, ImageOps, ImageEnhance

ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'Fragrantica ID Database'/'rebuild-top100'
SRC=DB/'new-identities-verified.json'
OUT=DB/'new-identities-main-notes.json'
VOCAB=ROOT/'Personal Database'/'fragrantica-note-vocabulary.txt'
IMGDIR=ROOT/'artifacts'/'clean-top100-missing-social-cards'
IMGDIR.mkdir(parents=True,exist_ok=True)
CELLS=[(64,888,184,956),(184,888,304,956),(304,888,430,956),(64,1024,184,1100),(184,1024,304,1100),(304,1024,430,1100)]

def clean_text(s):
    s=s.replace('\n',' ').replace('\r',' ')
    s=re.sub(r"[^A-Za-z0-9À-ÿ&()\-'’., ]+",' ',s)
    return re.sub(r'\s+',' ',s).strip(' .,-')

def key(s): return re.sub(r'[^a-z0-9]+','',s.lower().replace('’',"'"))

def load_vocab():
    vals=[]
    if VOCAB.exists(): vals=[x.strip() for x in VOCAB.read_text(encoding='utf-8').splitlines() if x.strip()]
    return list(dict.fromkeys(vals))

def normalize(raw,vocab):
    rk=key(raw); best=raw; score=0.0
    for v in vocab:
        vk=key(v); s=difflib.SequenceMatcher(None,rk,vk).ratio()
        if vk and (vk in rk or rk in vk): s=max(s,min(len(vk),len(rk))/max(len(vk),len(rk))*0.25+0.72)
        if s>score: best,score=v,s
    return best,round(score*100,1)

def ocr_crop(img,box):
    crop=ImageEnhance.Contrast(ImageOps.autocontrast(img.crop(box).convert('L'))).enhance(1.8)
    crop=crop.resize((crop.width*4,crop.height*4))
    with tempfile.NamedTemporaryFile(suffix='.png',delete=False) as f: tmp=Path(f.name)
    crop.save(tmp)
    try:
        p=subprocess.run(['tesseract',str(tmp),'stdout','--psm','6','-l','eng','tsv'],capture_output=True,text=True,check=False)
        words=[]
        for line in p.stdout.splitlines()[1:]:
            z=line.split('\t')
            if len(z)>=12 and z[11].strip(): words.append(z[11].strip())
        return clean_text(' '.join(words))
    finally: tmp.unlink(missing_ok=True)

def fetch_image(fid,path):
    url=f'https://fimgs.net/mdimg/perfume-social-cards/en-p_c_{fid}.jpeg'
    for attempt in range(1,5):
        try:
            req=Request(url,headers={'User-Agent':'Mozilla/5.0'})
            data=urlopen(req,timeout=30).read()
            if len(data)<1000: raise RuntimeError(f'too-small:{len(data)}')
            path.write_bytes(data); return url,len(data)
        except Exception:
            if attempt==4: raise
            time.sleep(attempt*2)

def main():
    vocab=load_vocab(); src=json.loads(SRC.read_text(encoding='utf-8'))['records']; rows=[]
    for rec in src:
        fid=int(rec['fragrantica_id']); rank=int(rec['rank']); path=IMGDIR/f'{rank:03d}-{fid}.jpeg'
        url,bytes_=fetch_image(fid,path)
        img=Image.open(path); notes=[]
        for pos,box in enumerate(CELLS,1):
            raw=ocr_crop(img,box)
            if not raw: continue
            canonical,match=normalize(raw,vocab)
            notes.append({'position':pos,'note':canonical,'raw_ocr':raw,'vocab_match':match})
        min_match=min((n['vocab_match'] for n in notes),default=0)
        status='verified' if notes and min_match>=82 else 'review'
        rows.append({**rec,'social_card_url':url,'social_card_bytes':bytes_,'note_count':len(notes),'main_notes':[n['note'] for n in notes],'evidence':notes,'status':status})
        print(f"#{rank} {rec['perfume']} {status}: "+' | '.join(n['note'] for n in notes))
    payload={'schema_version':1,'method':'Fragrantica ID Mapping Rule / social-card Main Notes','count':len(rows),'verified_count':sum(r['status']=='verified' for r in rows),'review_count':sum(r['status']=='review' for r in rows),'records':rows}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"NOTES_VERIFIED={payload['verified_count']}/10 REVIEW={payload['review_count']}")

if __name__=='__main__': main()
