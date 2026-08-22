#!/usr/bin/env python3
import colorsys
import io
import json
import urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'Fragrantica ID Database' / 'rebuild-top100' / 'top100-fragrantica-mapped.json'
OUT = ROOT / 'Fragrantica ID Database' / 'rebuild-top100' / 'social-card-seasons-test-1-10.json'
SEASONS = ['winter', 'spring', 'summer', 'autumn']

# Fragrantica public social cards are currently 1000x1000 and the season widget
# is drawn in a fixed 2x2 layout in the lower-right panel. Coordinates below
# are normalized from the public card template so they remain valid if the
# image is resized proportionally.
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
    x0, y0, x1, y1 = (
        int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)
    )
    crop = img.crop((x0, y0, x1, y1))
    cw, ch = crop.size

    # Ignore rounded edges and use the central vertical band. The inactive bar
    # is neutral gray (very low saturation); the active fill is strongly colored.
    y_start = max(0, int(ch * 0.22))
    y_end = min(ch, int(ch * 0.78))
    column_scores = []
    for x in range(cw):
        sat_hits = 0
        total = max(1, y_end - y_start)
        for y in range(y_start, y_end):
            if saturation(crop.getpixel((x, y))) >= 0.18:
                sat_hits += 1
        column_scores.append(sat_hits / total)

    # Find the contiguous colored run from the left side of the bar. A few
    # leading columns can be affected by rounded corners, so start after 2%.
    start = max(1, int(cw * 0.02))
    end = start
    gap = 0
    for x in range(start, cw):
        colored = column_scores[x] >= 0.45
        if colored:
            end = x
            gap = 0
        else:
            gap += 1
            if gap >= 5 and end > start:
                break
    fill_px = max(0, end - start + 1)
    return {
        'fill_px': fill_px,
        'bar_width_px': cw,
        'fill_ratio': round(fill_px / cw, 4) if cw else 0,
    }


def main():
    payload = json.loads(SRC.read_text(encoding='utf-8'))
    rows = [r for r in payload['records'] if 1 <= int(r['rank']) <= 10]
    if len(rows) != 10:
        raise SystemExit(f'Expected 10 records, got {len(rows)}')

    results = []
    for rec in rows:
        img = download(rec['social_card_url'])
        measurements = {s: measure_fill(img, BOXES[s]) for s in SEASONS}
        best = max(SEASONS, key=lambda s: measurements[s]['fill_px'])
        ordered = sorted(SEASONS, key=lambda s: measurements[s]['fill_px'], reverse=True)
        margin = measurements[ordered[0]]['fill_px'] - measurements[ordered[1]]['fill_px']
        status = 'clear' if margin >= 3 else 'near-tie'
        results.append({
            'rank': rec['rank'],
            'shobi_code': rec['shobi_code'],
            'perfume': rec['perfume'],
            'fragrantica_id': rec['fragrantica_id'],
            'social_card_url': rec['social_card_url'],
            'image_size': list(img.size),
            'measurements': measurements,
            'season_from_card': best,
            'winner_margin_px': margin,
            'status': status,
        })
        m = measurements
        print(
            f"#{rec['rank']} {rec['perfume']}: "
            f"winter={m['winter']['fill_px']}px spring={m['spring']['fill_px']}px "
            f"summer={m['summer']['fill_px']}px autumn={m['autumn']['fill_px']}px "
            f"=> {best.upper()} margin={margin}px status={status}"
        )

    out = {
        'schema_version': 1,
        'method': 'Fragrantica public social-card season bar pixel measurement; longest of winter/spring/summer/autumn wins',
        'count': len(results),
        'clear_count': sum(r['status'] == 'clear' for r in results),
        'near_tie_count': sum(r['status'] == 'near-tie' for r in results),
        'records': results,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"SOCIAL_CARD_SEASON_TEST={len(results)}/10 CLEAR={out['clear_count']} NEAR_TIE={out['near_tie_count']}")


if __name__ == '__main__':
    main()
