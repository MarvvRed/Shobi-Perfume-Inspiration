# OFFICIAL CATCHER — Shobi Fragrantica Main Notes Collector

## Status

**OFFICIAL / VALIDATED — version 0.3.5**

This folder is the frozen reference copy of the currently validated catcher.

Validation: successful end-to-end batch of 10/10 perfumes, including both extraction paths.

## Official rules

- **1–5 fragrance notes:** save every available note directly. No vote ranking is required because every note belongs in the result.
- **6+ fragrance notes:** use **Perfume Pyramid / Fragrance Notes → Show votes**, read the real vote counts, sort descending, and save the **Top 5 most-voted notes**.
- `Hide votes` is accepted as an already-open vote state.
- Extraction is scoped to the local fragrance-notes block around the vote control to avoid counting unrelated `/notes/` links elsewhere on the page.

## Validated edge cases

- **The Muse — ZARKOPERFUME:** 3 notes → all 3 saved successfully.
- **Devotion — Dolce&Gabbana:** exactly 5 notes → all 5 saved successfully.
- **Cheirosa '62 — Sol de Janeiro:** more than 5 notes → Top 5 selected correctly by vote count.

## Protection rule

Treat this directory as the known-good official snapshot. Do not modify it during experimental development. New changes should be made and tested in the parent `firefox-extension` directory first, and only promoted here after validation.
