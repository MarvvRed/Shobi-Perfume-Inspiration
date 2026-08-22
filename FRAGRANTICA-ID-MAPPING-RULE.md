# Fragrantica ID Mapping Rule

## Status

**OFFICIAL METHOD — Shobi Perfume Database**

This rule is the canonical method for associating a Shobi perfume with Fragrantica resources. It must be applied consistently to all perfumes. Individual perfume-specific hardcoded exceptions must not replace this mapping method.

## Canonical mapping

```text
Shobi rank + Shobi code
        ↓
Verified perfume identity on Fragrantica
        ↓
Fragrantica ID
        ↓
        ├── Fragrantica perfume page
        ├── Fragrantica social card → Main Notes verification/extraction
        ├── Fragrantica WHEN TO WEAR → Season extraction
        └── Fragrantica perfume image
```

The **Fragrantica ID is the central canonical key**.

## Resource derivation

For a verified Fragrantica ID `ID`:

### Social card

```text
https://fimgs.net/mdimg/perfume-social-cards/en-p_c_ID.jpeg
```

The social card is the authoritative source used by this project for Main Notes verification/extraction.

### Main Notes rule — LOCKED

**Take every Main Note shown on the Fragrantica social card, in the exact displayed order.**

Rules:

1. Do not impose a fixed note count such as Top 5, Top 6 or Top 10.
2. If the social card shows 6 notes, store 6.
3. If the social card shows 5 notes, store 5.
4. If the social card shows 3 notes, store 3.
5. Never truncate a valid social-card note list with logic such as `slice(0,5)` or any other arbitrary limit.
6. Never add notes that are not shown on the social card.
7. Preserve the exact ranking/order displayed by Fragrantica.
8. When legacy/runtime code conflicts with this rule, the social-card list is authoritative and the legacy truncation must be removed or bypassed.

Canonical principle:

```text
Main Notes = ALL notes visible on the Fragrantica social card, in displayed order.
```

### Season rule — LOCKED

The Fragrantica perfume page's public **WHEN TO WEAR** block is the authoritative source for Season.

Consider only:

```text
winter
spring
summer
fall
```

Ignore `day` and `night` for Season assignment.

The canonical Season is the season with the highest vote value among Winter, Spring, Summer and Fall.

Example:

```text
winter 5.9k
spring 13k
summer 13.3k
fall 9.8k

Season = Summer
```

Rules:

1. Read the public WHEN TO WEAR values from the verified Fragrantica perfume page.
2. Compare only Winter, Spring, Summer and Fall.
3. Assign the season with the highest value.
4. Do not infer Season from notes, accords, perfume family, description or external opinion.
5. Do not use Day/Night to determine Season.
6. If the WHEN TO WEAR values cannot be verified, leave Season unresolved rather than guessing.

Canonical principle:

```text
Season = winner of Fragrantica WHEN TO WEAR among Winter / Spring / Summer / Fall.
```

### Perfume image

```text
https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.ID.avif
```

### Fragrantica page

The exact verified Fragrantica perfume URL associated with the same ID must be stored in the mapping.

## Required mapping record

At minimum, each verified perfume mapping must preserve:

```text
Shobi rank → Shobi code → Fragrantica ID → Fragrantica URL
```

All Fragrantica-derived resources for that perfume must refer to that same verified ID.

## Integrity rules

1. Never guess a Fragrantica ID.
2. Verify the Shobi perfume identity before accepting the ID.
3. Once verified, use that ID as the common key for the Fragrantica page, social card, Main Notes, Season and perfume image.
4. Do not mix notes, seasons, images or URLs belonging to different Fragrantica IDs.
5. Do not introduce perfume-specific hardcoded image/resource exceptions when the standard ID mapping can provide the resource.
6. If a resource cannot be obtained or verified from the mapped ID, treat it as unresolved instead of silently substituting data from another perfume.
7. Existing stable site functionality must not be changed merely to implement this rule; changes must be limited to the data/mapping path required by the task.

## Frozen operational rule

For the Shobi Top 100 enrichment phase:

```text
Notes  = all notes shown on the mapped Fragrantica social card, exact order
Season = highest-voted season in mapped Fragrantica WHEN TO WEAR
```

These rules are fixed and must not be replaced by legacy Top 5 note truncation, arbitrary note-count targets, note-based season inference, or other heuristic extraction methods.

## Principle

**One verified perfume identity → one Fragrantica ID → one coherent set of Fragrantica resources.**
