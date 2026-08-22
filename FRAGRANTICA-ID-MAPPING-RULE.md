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
        └── Fragrantica perfume image
```

The **Fragrantica ID is the central canonical key**.

## Resource derivation

For a verified Fragrantica ID `ID`:

### Social card

```text
https://fimgs.net/mdimg/perfume-social-cards/en-p_c_ID.jpeg
```

The social card is the reference used by this project for Main Notes verification/extraction according to the project's note rules.

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
3. Once verified, use that ID as the common key for the Fragrantica page, social card, Main Notes and perfume image.
4. Do not mix notes, images or URLs belonging to different Fragrantica IDs.
5. Do not introduce perfume-specific hardcoded image/resource exceptions when the standard ID mapping can provide the resource.
6. If a resource cannot be obtained or verified from the mapped ID, treat it as unresolved instead of silently substituting data from another perfume.
7. Existing stable site functionality must not be changed merely to implement this rule; changes must be limited to the data/mapping path required by the task.

## Principle

**One verified perfume identity → one Fragrantica ID → one coherent set of Fragrantica resources.**
