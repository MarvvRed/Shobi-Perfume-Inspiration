# Fragrantica Note Icon Registry

Authoritative source: https://www.fragrantica.com/notes/

This folder stores a generated registry mapping Fragrantica note names to their official ingredient IDs. The site derives note icon URLs as:

`https://fimgs.net/mdimg/sastojci/t.<ID>.jpg`

The registry is refreshed automatically by `.github/workflows/sync-fragrantica-note-icons.yml` using `scripts/sync-fragrantica-note-icons.mjs`.

We intentionally store the compact ID registry rather than duplicating the full image library in GitHub. This keeps the repository small while still using the official Fragrantica note-image database.
