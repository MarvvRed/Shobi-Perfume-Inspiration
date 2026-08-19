# CARD DEFAULT V3

Status: APPROVED CANONICAL REFERENCE

## Source of truth

Card Default V3 is the current live BLEU / CHANEL card as explicitly approved by the user on 2026-08-18, in both Light Mode and Dark Mode.

This reference MUST be used as the visual and structural model for perfume cards. Do not redesign, reinterpret, approximate, or replace it with an older card version.

## Canonical identity

- Perfume: BLEU
- Brand: CHANEL
- Bestseller: BEST SELLER #24
- Gender: Men
- Seasons: Spring, Summer, Autumn, Winter
- Main notes: Grapefruit, Lemon, Mint, Pink Pepper, Ginger
- Fragrantica badge over bottle image
- Actions, in order: More detail; SHOP ON SHOBI; Favorite + Collection

## Canonical layout order

1. Perfume name
2. Brand
3. Bestseller badge
4. Bottle image with Fragrantica badge
5. Gender + season chips
6. MAIN NOTES
7. Note chips
8. More detail
9. SHOP ON SHOBI
10. Favorite + Collection

## Light Mode reference

- Warm off-white card/background treatment
- BLEU name: black
- CHANEL: gold
- BEST SELLER #24: black text on light badge with gold border
- More detail: black text and black eye icon
- SHOP ON SHOBI: gold filled button with black text/icon
- Favorite and Collection: black text/icons on light background

## Dark Mode reference

- Dark charcoal card/background treatment
- BLEU name: light/white
- CHANEL: gold
- BEST SELLER #24: gold text on dark badge with gold border
- More detail: gold text and gold eye icon
- SHOP ON SHOBI: lighter gold filled button with black text/icon
- Favorite and Collection: same gold text/icon treatment as More detail

## Implementation rule

When Card Default V3 is applied to other perfumes, preserve the Card Default V3 structure and styling while keeping each perfume's data dynamic: name, brand, bestseller rank, bottle image, Fragrantica URL, Shobi URL, gender, seasons, notes, Favorite state, and Collection state.

The approved BLEU card itself must not be altered merely to generalize the renderer.

## Safety rule

Before any rollout to all cards, compare BLEU Light and Dark against the approved live reference. If BLEU changes visually, the rollout is invalid and must not be promoted.
