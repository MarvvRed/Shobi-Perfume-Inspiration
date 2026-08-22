# Fragrantica ID Database

## Status

**OFFICIAL CANONICAL DATA METHOD — Shobi Perfume Database**

This directory is the canonical home of the **Fragrantica ID Mapping Rule** and of the verified Fragrantica-linked data used by the project.

## Official rule

```text
SHOBI
  ↓
Verified perfume identity on Fragrantica
  ↓
FRAGRANTICA ID
  │
  ├──► Fragrantica page
  ├──► Social card → Main Notes
  ├──► Perfume image
  ├──► Gender
  └──► Season / seasonal consensus
```

The **Fragrantica ID is the canonical key**.

## Core principle

**One verified perfume identity → one Fragrantica ID → one coherent set of Fragrantica resources.**

No independent mixing of image, notes, gender or season from unrelated perfume identities is allowed.

## Canonical resources derived/associated from ID

For a verified Fragrantica ID `ID`:

```text
Social card:
https://fimgs.net/mdimg/perfume-social-cards/en-p_c_ID.jpeg

Perfume image:
https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.ID.avif
```

The exact verified Fragrantica perfume page URL is stored with the same ID.

## Data rules

1. Never guess a Fragrantica ID.
2. Verify the Shobi ↔ Fragrantica perfume identity first.
3. Store `Shobi rank → Shobi code → Fragrantica ID → Fragrantica URL`.
4. Main Notes must belong to that same verified Fragrantica ID.
5. Image must belong to that same verified Fragrantica ID.
6. Gender must be read/verified from the same Fragrantica identity.
7. Season must be based on the seasonal information/consensus associated with that same Fragrantica identity; do not infer it independently from notes when source data is available.
8. If any field cannot be verified, leave it unresolved rather than substituting unrelated data.
9. Do not introduce perfume-specific hardcoded exceptions when the normal ID mapping can resolve the resource.
10. Stable site functionality must not be changed merely to organize this database.

## Canonical record

See `schema.json`.

A complete verified record is intended to contain:

```text
rank
shobi_code
perfume_name
brand
fragrantica_id
fragrantica_url
social_card_url
image_url
main_notes
gender
season
verification_status
```

## Current Best Seller 1–100 verified datasets

The current verified source datasets are indexed in:

`mappings/bestseller-001-100-manifest.json`

They remain the authoritative source material while the unified canonical records are progressively materialized into this directory.

## Unresolved data

Anything not verified must be recorded under `validation/unresolved.json` rather than guessed.
