# Shobi Fragrantica Main Notes Collector — OFFICIAL CATCHER

## Official validated collector

**Status: OFFICIAL / VALIDATED**

The Firefox extension in this folder is the official Shobi Fragrantica catcher for extracting the **Top 5 most-voted perfume notes** from Fragrantica.

Validated version: **0.3.1**

## Source of truth

The collector targets the **Perfume Pyramid → Show votes** control on a Fragrantica perfume page.

It does **not** use Main Accords and does **not** treat the plain perfume pyramid order as the ranking.

Official extraction flow:

1. Open the Fragrantica perfume page in the real Firefox session.
2. Locate **Show votes** inside the Perfume Pyramid.
3. Click **Show votes**.
4. Read every ingredient note and its displayed vote count.
5. Deduplicate notes by Fragrantica ingredient ID/name.
6. Sort by vote count descending.
7. Keep the **Top 5 most-voted notes**.
8. Send the validated payload through the local bridge to GitHub.

## Validation reference — Vanilla 28

The official catcher was validated end-to-end on Kayali Vanilla 28 (Fragrantica 52616).

Expected Top 5 at validation time:

1. Brown sugar — 2585 votes
2. Tonka Bean — 1830 votes
3. Amber — 1524 votes
4. Amberwood — 1082 votes
5. Vanilla Orchid — 1024 votes

The saved payload uses `capture_method: show-votes-top5` and records `total_voted_notes` before reducing the result to the Top 5.

## Important rule

**Do not replace or redesign this extraction method unless a regression is demonstrated.** Future automation should build around this validated catcher rather than changing its core Show Votes extraction logic.

## Temporary install in Firefox

1. Open `about:debugging`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on…**.
4. Select `manifest.json` from this folder.
5. Use the real Firefox session for Fragrantica.

This extension is isolated under `tools/fragrantica-main-notes/` and does not modify the Shobi website itself.
