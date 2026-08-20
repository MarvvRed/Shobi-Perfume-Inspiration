# OFFICIAL CATCHER — Shobi Fragrantica Main Notes Collector

## Status

**OFFICIAL / VALIDATED / FROZEN — version 0.3.8**

This folder is the frozen reference copy of the currently validated catcher.

Validation: successful end-to-end capture and GitHub persistence, including both extraction paths and the critical ≤5-note vote-order cases.

## Official rules

- **1–5 fragrance notes:** read the real Fragrantica vote counts, order all available notes by votes descending, and save every note.
- **6+ fragrance notes:** use **Perfume Pyramid / Fragrance Notes → Show votes**, read the real vote counts, sort descending, and save the **Top 5 most-voted notes**.
- `Hide votes` is accepted as an already-open vote state.
- Extraction is scoped to the local fragrance-notes block around the vote control to avoid counting unrelated `/notes/` links elsewhere on the page.
- The on-page status badge reports capture progress and turns green only after the local bridge confirms the capture was saved to GitHub.
- If vote parsing is unavailable for a ≤5-note fragrance, the catcher retains the explicit no-votes fallback rather than dropping the perfume.

## Validated edge cases

- **The Muse — ZARKOPERFUME:** 3 notes → all 3 captured with votes and correctly ordered: Cotton Flower (450), White Musk (370), White Oud (155).
- **Devotion — Dolce&Gabbana:** exactly 5 notes → all 5 captured with votes and correctly ordered: Candied Lemon (3731), Vanilla (3382), Panacotta (2070), Orange Blossom (1723), Rum (1266).
- **Cheirosa '62 — Sol de Janeiro:** more than 5 notes → Top 5 selected correctly by vote count.
- **GitHub persistence:** validated via the green `Saved to GitHub` status and direct verification of `Personal Database/fragrantica-main-notes.json`.

## Protection rule

Treat this directory as the known-good official snapshot for **0.3.8**. Do not modify it during experimental development. New changes should be made and tested outside this frozen snapshot first, and only promoted here after validation.
