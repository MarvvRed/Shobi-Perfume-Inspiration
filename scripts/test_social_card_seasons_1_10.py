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

# Dynamic detector. Do NOT use fixed bar coordinates.
# Fragrantica social cards render the four season fills with stable color families.
# We scan only the lower season area, locate the strongest horizontal run for each
# season color, and use its actual run width. This survives layout shifts such as
# the Stronger With You Intensely card that broke the old fixed-coordinate method.
HUE_RULES = {
    'winter': (0.52, 0.68, 0.20),
    'spring': (0.18, 0.38, 0.25),
    'summer': (0.085, 0.14, 0.35),
    'autumn': (0.00, 0.085, 0.35),
}
SCAN_Y_START = 0.86
SCAN_X_START = 0.35


def download(url: str) -> Image.Image:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return Image.open(io.BytesIO(data)).convert('RGB')


def hsv(rgb):
    r, g, b = (c / 255.0 for c in rgb)
    return colorsys.rgb_to_hsv(r, g, b)


def matches(rgb, rule):
    lo, hi, min_sat = rule
    h, s, _ = hsv(rgb)
    return lo <= h < hi and s >= min_sat


def longest_run(bits):
    best_start = best_end = -1
    cur_start = None
    for i, v in enumerate(bits):
        if v and cur_start is None:
            cur_start = i
        if cur_start is not None and ((not v) or i == len(bits) - 1):
            end = i if v and i == len(bits) - 1 else i - 1
            if best_start < 0 or end - cur_start > best_end - best_start:
                best_start, best_end = cur_start, end
            cur_start = None
    if best_start < 0:
        return 0, None, None
    return best_end - best_start + 1, best_start, best_end


def measure_season(img: Image.Image, season: str):
    w, h = img.size
    x0 = int(w * SCAN_X_START)
    y0 = int(h * SCAN_Y_START)
    rule = HUE_RULES[season]

    best = {'fill_px': 0, 'row_y': None, 'x_start': None, 'x_end': None}
    # For each row, find the longest contiguous run of that season's color.
    # The real bar fill creates a much longer run than icons/text/background noise.
    for y in range(y0, h):
        bits = [matches(img.getpixel((x, y)), rule) for x in range(x0, w)]
        run, start, end = longest_run(bits)
        if run > best['fill_px']:
            best = {
                'fill_px': run,
                'row_y': y,
                'x_start': (x0 + start) if start is not None else None,
                'x_end': (x0 + end) if end is not None else None,
            }
    best['fill_ratio_image'] = round(best['fill_px'] / w, 4) if w else 0
    return best


def measure_card(img: Image.Image):
    return {s: measure_season(img, s) for s in SEASONS}


def winner(measurements):
    # Stable tie-break rule requested for exact pixel equality:
    # Winter -> Spring -> Summer -> Autumn (the card display order).
    ordered = sorted(SEASONS, key=lambda s: (-measurements[s]['fill_px'], SEASONS.index(s)))
    first, second = ordered[0], ordered[1]
    margin = measurements[first]['fill_px'] - measurements[second]['fill_px']
    return first, second, margin


def main():
    payload = json.loads(SRC.read_text(encoding='utf-8'))
    all_rows = payload['records']
    rows = [r for r in all_rows if 1 <= int(r['rank']) <= 10]
    canary = next((r for r in all_rows if int(r['rank']) == 82), None)
    if len(rows) != 10 or canary is None:
        raise SystemExit(f'Expected ranks 1-10 plus rank 82 canary; got {len(rows)} / canary={bool(canary)}')

    results = []
    for rec in rows:
        img = download(rec['social_card_url'])
        measurements = measure_card(img)
        first, second, margin = winner(measurements)
        results.append({
            'rank': rec['rank'], 'shobi_code': rec['shobi_code'], 'perfume': rec['perfume'],
            'fragrantica_id': rec['fragrantica_id'], 'social_card_url': rec['social_card_url'],
            'image_size': list(img.size), 'measurements': measurements,
            'season_from_card': first, 'runner_up': second, 'winner_margin_px': margin,
        })
        m = measurements
        print(
            f"#{rec['rank']} {rec['perfume']}: "
            f"winter={m['winter']['fill_px']}px spring={m['spring']['fill_px']}px "
            f"summer={m['summer']['fill_px']}px autumn={m['autumn']['fill_px']}px "
            f"=> {first.upper()} margin={margin}px"
        )

    # Regression canary for the exact card that exposed the old coordinate bug.
    img = download(canary['social_card_url'])
    cm = measure_card(img)
    cfirst, csecond, cmargin = winner(cm)
    print(
        f"CANARY #82 {canary['perfume']}: winter={cm['winter']['fill_px']}px "
        f"spring={cm['spring']['fill_px']}px summer={cm['summer']['fill_px']}px "
        f"autumn={cm['autumn']['fill_px']}px => {cfirst.upper()} margin={cmargin}px"
    )
    if cfirst != 'winter':
        raise SystemExit(f'Safety stop: rank 82 regression canary must resolve WINTER, got {cfirst}')

    out = {
        'schema_version': 2,
        'method': 'Dynamic Fragrantica social-card season color-run detection; no fixed bar coordinates; longest bar wins; exact tie uses Winter->Spring->Summer->Autumn',
        'count': len(results),
        'records': results,
        'regression_canary_rank_82': {
            'perfume': canary['perfume'], 'measurements': cm,
            'season_from_card': cfirst, 'runner_up': csecond, 'winner_margin_px': cmargin,
            'passed': cfirst == 'winter',
        },
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"DYNAMIC_SOCIAL_CARD_SEASON_TEST=10/10 CANARY_82={cfirst.upper()} PASS=1")


if __name__ == '__main__':
    main()
