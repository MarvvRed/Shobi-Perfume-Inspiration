# Shobi Project Database

This folder is the canonical internal knowledge base for the Shobi Perfume Inspiration project.

Its purpose is to prevent approved decisions, canonical files, data-source rules and stable UI references from being lost or re-created from memory.

## Golden rule

Before any future structural change, data sync, card redesign, deployment or rebuild, read `project-database/registry.json` and use the canonical assets listed there.

Do not replace a canonical asset with an older root file, preview, temporary test, workflow artifact or regenerated file unless the user explicitly approves that change.

## Canonical assets

- Definitive site baseline: `preview-v2/index.html`
- Definitive public reference: `https://marvvred.github.io/Shobi-Perfume-Inspiration/preview-v2/`
- Canonical perfume-card design: `design-library/card-v2-perfect.html`
- Canonical card registry: `design-library/index.json`
- Canonical Shobi master database: `shobi-master.csv`
- Canonical Shobi bestseller ordering: `shobi-bestsellers.json`
- Site runtime generated from canonical data: `site-runtime-v2.json`
- Source rules/documentation: `DATA-SOURCES.md`

## Data flow

Official Shobi data -> canonical acquisition files -> `shobi-master.csv` -> site runtime -> definitive site.

The master CSV is the source of truth for normalized perfume records used by the project. Derived runtime files are outputs, not substitutes for the master.

## UI rule

`preview-v2/index.html` is the definitive site baseline. The Card V2 stored in the design library is the canonical perfume-card reference. `1067-CHA` / Bleu de Chanel is the approved visual/reference implementation for the card model, but the model applies to all perfumes.

## Versioning rule

Every future approved replacement of a canonical asset must be recorded in `project-database/registry.json` with its path, status, role and, where useful, a commit/blob SHA. Old canonical references must not be silently overwritten in documentation.
