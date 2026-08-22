#!/usr/bin/env python3
import json, re, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance

ROOT=Path(__file__).resolve().parents[1]
IMG_DIR=ROOT/'artifacts'/'fragrantica-social-cards-101-200'
MANIFEST=ROOT/'Personal Database'/'bestseller-101-200-social-card-manifest.json'
OUT=ROOT/'Personal Database'/'bestseller-101-200-social-card-notes-ocr.json'

# Fragrantica social-card note labels: 3 columns x 2 rows in a 1200x1200 card.
# Crop only the text-label area under each note image.
CELLS=[
    (64, 888, 184, 956), (184, 888, 304, 956), (304, 888, 430, 956),
    (64, 1024, 184, 1100), (184, 1024, 304, 1100), (304, 1024, 430, 1100),
]

def clean_text(s):
    s=s.replace('\n',' ').replace('\r',' ')
    s=re.sub(r'[^A-Za-z0-9À-ÿ&()\-\'’., ]+',' ',s)
    s=re.sub(r'\s+',' ',s).strip(' .,-')
    return s

def ocr_crop(img, box):
    crop=img.crop(box).convert('L')
    crop=ImageOps.autocontrast(crop)
    crop=ImageEnhance.Contrast(crop).enhance(1.8)
    crop=crop.resize((crop.width*4,crop.height*4))
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        tmp=Path(f.name)
    crop.save(tmp)
    try:
        proc=subprocess.run(['tesseract',str(tmp),'stdout','--psm','6','-l','eng','tsv'],capture_output=True,text=True,check=False)
        rows=[]
        for line in proc.stdout.splitlines()[1:]:
            parts=line.split('\t')
            if len(parts)<12: continue
            text=parts[11].strip()
            try: conf=float(parts[10])
            except: conf=-1
            if text and conf>=0: rows.append((text,conf))
        text=clean_text(' '.join(t for t,_ in rows))
        conf=sum(c for _,c in rows)/len(rows) if rows else 0.0
        return text,round(conf,1)
    finally:
        tmp.unlink(missing_ok=True)

def main():
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    by_rank={int(x['rank']):x for x in manifest}
    results=[]
    for rank in sorted(by_rank):
        rec=by_rank[rank]
        fid=int(rec['fragrantica_id'])
        path=IMG_DIR/f'{rank:03d}-{fid}.jpeg'
        if not path.exists():
            results.append({**rec,'status':'missing-image','notes':[]})
            continue
        img=Image.open(path)
        if img.size!=(1200,1200):
            results.append({**rec,'status':'unexpected-size','size':list(img.size),'notes':[]})
            continue
        notes=[]
        for i,box in enumerate(CELLS,1):
            text,conf=ocr_crop(img,box)
            # blank cell is normal when fragrance has fewer than six displayed notes
            if text:
                notes.append({'position':i,'text':text,'confidence':conf})
        min_conf=min((n['confidence'] for n in notes),default=0)
        status='candidate' if notes and min_conf>=55 else 'review'
        results.append({
            'rank':rank,'code':rec.get('code',''),'inspired_by':rec.get('inspired_by',''),
            'brand':rec.get('brand',''),'fragrantica_id':fid,'fragrantica_url':rec.get('fragrantica_url',''),
            'status':status,'note_count':len(notes),'min_confidence':min_conf,'notes':notes
        })
        print(f"#{rank} notes={len(notes)} min_conf={min_conf:.1f} status={status} :: " + ' | '.join(n['text'] for n in notes))
    summary={
        'count':len(results),
        'candidate_count':sum(r.get('status')=='candidate' for r in results),
        'review_count':sum(r.get('status')=='review' for r in results),
        'missing_image_count':sum(r.get('status')=='missing-image' for r in results),
        'pending_rank':149,
        'rows':results,
    }
    OUT.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('SOCIAL_CARD_NOTE_ROWS',len(results))
    print('CANDIDATE_COUNT',summary['candidate_count'])
    print('REVIEW_COUNT',summary['review_count'])

if __name__=='__main__': main()
