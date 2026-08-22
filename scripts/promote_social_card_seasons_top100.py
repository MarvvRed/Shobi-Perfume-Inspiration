#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'Fragrantica ID Database' / 'rebuild-top100'
AUDIT = DB / 'social-card-seasons-audit-top100.json'
OUT = DB / 'top100-seasons.json'
SEASONS = ['winter', 'spring', 'summer', 'autumn']


def main():
    payload = json.loads(AUDIT.read_text(encoding='utf-8'))
    rows = payload.get('records') or []
    failures = payload.get('failures') or []
    if len(rows) != 100:
        raise SystemExit(f'Safety stop: dynamic social-card audit has {len(rows)} records, expected 100')
    if failures:
        raise SystemExit(f'Safety stop: dynamic social-card audit has {len(failures)} failures')

    by_rank = {int(r['rank']): r for r in rows}
    if sorted(by_rank) != list(range(1, 101)):
        raise SystemExit('Safety stop: audit ranks are not exactly 1..100')

    canary = by_rank[82]
    if canary.get('season') != 'winter' and canary.get('pixel_winner') != 'winter':
        raise SystemExit(f"Safety stop: rank 82 canary must be winter, got {canary.get('season') or canary.get('pixel_winner')}")

    out_rows = []
    for rank in range(1, 101):
        r = by_rank[rank]
        season = r.get('season') or r.get('pixel_winner')
        if season not in SEASONS:
            raise SystemExit(f'Safety stop: rank {rank} has invalid season {season!r}')
        measurements = r.get('measurements') or {}
        px = {s: int((measurements.get(s) or {}).get('fill_px') or 0) for s in SEASONS}
        if any(v <= 0 for v in px.values()):
            raise SystemExit(f'Safety stop: rank {rank} has incomplete pixel evidence {px}')
        max_px = max(px.values())
        winners = [s for s in SEASONS if px[s] == max_px]
        expected = winners[0]  # exact-tie order: winter -> spring -> summer -> autumn
        if season != expected:
            raise SystemExit(f'Safety stop: rank {rank} season {season} != deterministic winner {expected} from {px}')

        out_rows.append({
            'rank': rank,
            'shobi_code': r['shobi_code'],
            'fragrantica_id': r['fragrantica_id'],
            'social_card_url': r['social_card_url'],
            'source': 'Fragrantica public social card season bars',
            'season_bar_pixels': px,
            'season': season,
            'status': 'verified',
            'tie_break_rule': 'Winter -> Spring -> Summer -> Autumn on exact pixel equality',
            'winner_margin_px': int(r.get('winner_margin_px') or 0),
            'season_votes_percent': {},
        })

    out = {
        'schema_version': 5,
        'method': 'Dynamic Fragrantica social-card season color-run detection; longest bar wins; exact tie uses Winter->Spring->Summer->Autumn',
        'count': 100,
        'verified_count': 100,
        'unresolved_count': 0,
        'records': out_rows,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('SOCIAL_CARD_SEASONS_PROMOTED=100/100')
    print('SEASONS_VERIFIED=100/100 UNRESOLVED=0')
    print('CANARY_82=WINTER')


if __name__ == '__main__':
    main()
