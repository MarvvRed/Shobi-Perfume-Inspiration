# Fragrantica Notes Database

## Status

Canonical registry for Fragrantica note identities used by the Shobi Perfume Database.

## Authority

Public Fragrantica Notes index:

`https://www.fragrantica.com/notes/`

The builder extracts every public note link matching the canonical Fragrantica note URL pattern and stores:

- note name
- Fragrantica note ID
- category
- Fragrantica note URL
- public `fimgs` icon URL derived from the note ID

## Generated files

- `Fragrantica Notes Database/fragrantica-notes.json` — canonical full notes registry
- `fragrantica-notes-database.js` — browser-consumable registry

The generated JS deliberately exposes `window.FRAGRANTICA_NOTE_ICON_IDS` for compatibility with the current card renderer.

## Permanent rule

Do not maintain a hand-picked list of note icons for the canonical dataset.

The complete Fragrantica Notes Database is the authority for `note name → Fragrantica note ID → icon` resolution.

When new perfume batches are added, every canonical Main Note must resolve against this database. Missing entries are a validation failure and must be investigated before promotion.

## Top100 coverage gate

The builder audits all unique Main Notes in:

`Fragrantica ID Database/rebuild-top100/top100-fragrantica-mapped.json`

A build is not successful unless every canonical Top100 Main Note resolves in the full Fragrantica Notes Database.

## Builder

`scripts/build_fragrantica_notes_database.py`

The script contains safety guards against publishing an obviously incomplete scrape and fails on unresolved canonical Top100 notes.
