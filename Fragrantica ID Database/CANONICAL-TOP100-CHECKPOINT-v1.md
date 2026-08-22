# CANONICAL TOP100 CHECKPOINT v1

## Status

**OFFICIAL / CONFIRMED / FROZEN BASELINE**

This file freezes the confirmed canonical checkpoint for the Shobi Perfume Database Top 100.

Future work must build on this baseline. It must not silently rebuild, replace, reorder or overwrite the verified Top 100 fields documented here.

## Canonical pipeline

```text
MASTER UFFICIALE
2,343 / 2,343
        ↓
TAKE THE FIRST 100 RECORDS
        ↓
NEW CANONICAL TOP 100
        ↓
FRAGRANTICA ID MAPPING RULE
        ↓
VERIFY SHOBI ↔ FRAGRANTICA PERFUME IDENTITY
        ↓
CANONICAL FRAGRANTICA ID
        ↓
├── Fragrantica URL
├── Public Fragrantica social card
│     ├── Main Notes
│     │     ├── ALL visible notes
│     │     ├── exact displayed order
│     │     ├── exact displayed count
│     │     └── fixed Top-N truncation forbidden
│     │
│     └── Season
│           ├── dynamically detect the four seasonal bars
│           ├── select the longest bar
│           ├── exactly ONE canonical Season
│           ├── fixed pixel coordinates forbidden
│           └── exact tie: Winter → Spring → Summer → Autumn
│
├── Perfume image
│     └── must resolve from the same Fragrantica ID
│
├── Gender
│     └── verified against the same Fragrantica identity
│
└── FINAL VALIDATION
      ├── Fragrantica identity 100/100
      ├── Main Notes exact 100/100
      ├── Gender 100/100
      ├── Season 100/100
      └── Unresolved 0
```

## Verified checkpoint state

The canonical promotion completed with:

```text
SOCIAL_CARD_SEASONS_PROMOTED=100/100
SEASONS_VERIFIED=100/100 UNRESOLVED=0
CANARY_82=WINTER

CLEAN_TOP100_FRAGRANTICA_IDENTITY=100/100
SOCIAL_CARD_NOTES_EXACT=100/100
GENDER_VERIFIED=100/100
SEASON_VERIFIED=100/100

CANONICAL_TOP100_SEASONS=100/100
CANONICAL_TOP100_MAIN_NOTES=100/100
```

Canonical data promotion commit:

```text
5d8e67f — Promote verified social-card seasons into canonical Top100
```

The permanent method was subsequently formalized in the Fragrantica ID Database README, schema and Best Seller 001-100 manifest.

## Locked baseline fields

For the current canonical Top 100, the following are checkpoint-protected:

- Top 100 ranking/order derived from the official Master
- Shobi code / record identity
- Shobi ↔ Fragrantica verified identity mapping
- Fragrantica ID
- Fragrantica URL / associated resources
- Main Notes
- Gender
- Season

These fields must not be changed incidentally by unrelated work.

## Change-control rule

A future change to any checkpoint-protected field is allowed only when it is intentional and explicitly re-verified against the canonical source/method.

A replacement dataset must not be considered canonical merely because a script completes successfully. It must satisfy the same integrity rules and validation gates, and any change to the method itself must be documented.

## Permanent Main Notes rule

Authority: the public Fragrantica social card belonging to the same verified Fragrantica ID.

Store **every Main Note visible on the card**, preserving the **exact displayed order and count**. Never reduce the card to Top 5, Top 6, Top 10 or another fixed number.

## Permanent Season rule

Authority: the four seasonal bars on the public Fragrantica social card belonging to the same verified Fragrantica ID.

Detect the bars dynamically. The longest bar becomes the single canonical Season. If the maximum is exactly tied, select the first according to the card order:

```text
Winter → Spring → Summer → Autumn
```

Do not use fixed pixel coordinates.

### Regression canary

Top 100 rank #82 — **Emporio Armani Stronger With You Intensely** — must resolve to:

```text
WINTER
```

A Season pipeline that does not return Winter for this canary must not be promoted to the canonical dataset.

## Canonical principle

**One verified perfume identity → one Fragrantica ID → one coherent set of Fragrantica resources and verified fields.**

No image, Main Notes, Gender or Season may be mixed from a different Fragrantica perfume identity.

---

**Checkpoint designation:** `CANONICAL-TOP100-v1`

**Decision:** confirmed by the project owner and frozen as the official stable baseline.
