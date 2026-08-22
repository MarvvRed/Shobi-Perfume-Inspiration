#!/usr/bin/env python3
import colorsys
import io
import json
import urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'Fragrantica ID Database' / 'rebuild-top100' / 'top100-fragrantica-mapped.json'
OUT = ROOT / 'Fragrantica ID Database' / 'rebuild-top100' / 'social-card-seasons-audit-top100.json'
SEASONS = ['winter', 'spring', 'summer', 'autumn']
BOXES = {
    'winter': (0.416, 0.841, 0.671, 0.893),
    'spring': (0.679, 0.841, 0.934, 0.893),
    'summer': (0.416, 0.901, 0.671, 0.953),
    'autumn': (0.679, 0.901, 0.934, 0.953),
}


def download(url: str) -> Image.Image:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return Image.open(io.BytesIO(data)).convert('RGB')


def saturation(rgb):
    r, g, b = (c / 255.0 for c in rgb)
    return colorsys.rgb_to_hsv(r, g, b)[1]


def measure_fill(img: Image.Image, box):
    w, h = img.size
    x0, y0, x1, y1 = (int(box[0]*w), int(box[1]*h), int(box[2]*w), int(box[3]*h))
    crop = img.crop((x0, y0, x1, y1))
    cw, ch = crop.size
    y_start = max(0, int(ch * 0.22))
    y_end = min(ch, int(ch * 0.78))
    column_scores = []
    for x in range(cw):
        sat_hits = 0
        total = max(1, y_end-y_start)
        for y in range(y_start, y_end):
            if saturation(crop.getpixel((x,y))) >= 0.18:
                sat_hits += 1
        column_scores.append(sat_hits/total)
    start = max(1, int(cw*0.02))
    end = start
    gap = 0
    for x in range(start, cw):
        if column_scores[x] >= 0.45:
            end = x; gap = 0
        else:
            gap += 1
            if gap >= 5 and end > start:
                break
    fill_px = max(0, end-start+1)
    return {'fill_px': fill_px, 'bar_width_px': cw, 'fill_ratio': round(fill_px/cw,4) if cw else 0}


def main():
    payload = json.loads(SRC.read_text(encoding='utf-8'))
    rows = payload['records']
    if len(rows) != 100:
        raise SystemExit(f'Expected 100 records, got {len(rows)}')

    results = []
    failures = []
    for rec in rows:
        try:
            img = download(rec['social_card_url'])
            measurements = {s: measure_fill(img, BOXES[s]) for s in SEASONS}
            ordered = sorted(SEASONS, key=lambda s: measurements[s]['fill_px'], reverse=True)
            first, second = ordered[0], ordered[1]
            margin = measurements[first]['fill_px'] - measurements[second]['fill_px']
            status = 'clear' if margin >= 3 else 'ambiguous'
            season = first if status == 'clear' else None
            row = {
                'rank': rec['rank'], 'shobi_code': rec['shobi_code'], 'perfume': rec['perfume'],
                'fragrantica_id': rec['fragrantica_id'], 'social_card_url': rec['social_card_url'],
                'image_size': list(img.size), 'measurements': measurements,
                'pixel_winner': first, 'runner_up': second, 'winner_margin_px': margin,
                'season': season, 'status': status,
            }
            results.append(row)
            m = measurements
            print(f"#{rec['rank']} {rec['perfume']}: winter={m['winter']['fill_px']} spring={m['spring']['fill_px']} summer={m['summer']['fill_px']} autumn={m['autumn']['fill_px']} => {first.upper()} margin={margin}px status={status}")
        except Exception as e:
            failures.append({'rank': rec['rank'], 'shobi_code': rec['shobi_code'], 'perfume': rec['perfume'], 'error': str(e)})
            print(f"#{rec['rank']} {rec['perfume']}: ERROR {e}")

    clear = sum(r['status']=='clear' for r in results)
    ambiguous = sum(r['status']=='ambiguous' for r in results)
    out = {
        'schema_version': 1,
        'method': 'Fragrantica public social-card season bar pixel measurement; longest bar wins only when margin >=3px',
        'count': len(results), 'clear_count': clear, 'ambiguous_count': ambiguous,
        'download_failure_count': len(failures), 'records': results, 'failures': failures,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f"SOCIAL_CARD_SEASONS_AUDIT={len(results)}/100 CLEAR={clear} AMBIGUOUS={ambiguous} DOWNLOAD_FAILURES={len(failures)}")
    if failures:
        raise SystemExit(f'Safety stop: {len(failures)} social-card download failures')


if __name__ == '__main__':
    main()
