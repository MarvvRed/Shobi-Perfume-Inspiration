# Fragrantica ID Database

## Status

**OFFICIAL CANONICAL DATA METHOD — Shobi Perfume Database**

**Best Seller Top 100 status: COMPLETE / VERIFIED 100/100.**

This directory is the canonical home of the **Fragrantica ID Mapping Rule** and of the verified Fragrantica-linked data used by the project.

Current canonical Top 100 verification state:

```text
Shobi ranking / records              100/100
Verified Fragrantica identity / ID   100/100
Fragrantica URL                      100/100
Public social card                   100/100
Main Notes exact social-card match   100/100
Gender                               100/100
Season                               100/100
Unresolved                           0
```

## Official rule

```text
SHOBI
  ↓
Verified perfume identity on Fragrantica
  ↓
FRAGRANTICA ID
  │
  ├──► Fragrantica page
  ├──► Public social card
  │      ├──► Main Notes — ALL visible notes, exact displayed order/count
  │      └──► Season — dominant seasonal bar detected dynamically
  ├──► Perfume image
  └──► Gender
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

## Permanent data rules

1. Never guess a Fragrantica ID.
2. Verify the Shobi ↔ Fragrantica perfume identity first.
3. Store `Shobi rank → Shobi code → Fragrantica ID → Fragrantica URL`.
4. **Main Notes authority:** the public Fragrantica social card belonging to the same verified Fragrantica ID.
5. **Main Notes completeness rule:** preserve **ALL notes visible on the social card**, in the **exact displayed order and count**. Never truncate to a fixed Top 5, Top 6, Top 10 or any other fixed N.
6. Image must belong to that same verified Fragrantica ID.
7. Gender must be read/verified from the same Fragrantica identity.
8. **Season authority:** the four seasonal bars on the public Fragrantica social card belonging to the same verified Fragrantica ID.
9. **Season selection rule:** exactly one canonical Season per perfume; detect the actual seasonal bars dynamically and select the longest bar. Do not use fixed pixel coordinates. If the longest bars are exactly tied, use the social-card order `Winter → Spring → Summer → Autumn` as the deterministic tie-break.
10. Do not infer Season independently from notes when the social-card seasonal data is available.
11. If any field cannot be verified, leave it unresolved rather than substituting unrelated data.
12. Do not introduce perfume-specific hardcoded exceptions when the normal ID mapping can resolve the resource.
13. Stable site functionality must not be changed merely to organize this database.

## Season detector regression guard

**Emporio Armani Stronger With You Intensely (#82 in the verified Top 100) must resolve to `winter`.**

This record is the canary that exposed the obsolete fixed-coordinate detector. A Season pipeline must fail validation if this canary does not resolve to Winter.

## Canonical record

See `schema.json`.

A complete verified record contains the verified identity and the Fragrantica-linked resources/data for that same identity, including:

```text
rank
shobi_code
perfume_name / perfume
brand when materialized
fragrantica_id
fragrantica_url
social_card_url
image_url
main_notes
main_note_count
gender
season
season evidence / measured seasonal bars
verification status
```

## Current Best Seller 1–100 canonical datasets

The canonical materialized Top 100 is stored under:

`rebuild-top100/top100-fragrantica-mapped.json`

The canonical Season authority is stored under:

`rebuild-top100/top100-seasons.json`

The verified source datasets and identity history remain indexed in:

`mappings/bestseller-001-100-manifest.json`

The Top 100 is no longer considered progressively incomplete: the current canonical dataset is verified **100/100 for Fragrantica identity, Main Notes, Gender and Season**.

## Unresolved data

Anything not verified must be recorded as unresolved rather than guessed. For the current canonical Top 100, the verified promotion completed with **UNRESOLVED=0**.
