# Data sources

## Official Shobi catalogue — source of truth

The current Shobi perfume catalogue is sourced from the official Shobi Perfumery / LeParfum website at [leparfum.com.gr](https://leparfum.com.gr/).

`shobi-catalog.json` is an automated snapshot of the official perfume catalogue. The repository checks the official catalogue every six hours. New official entries can be added to the local catalogue immediately, but an entry is enriched with third-party perfume data only when its identity can be verified exactly and unambiguously.

SmellyCat is not the catalogue source of truth. Its public Shobi database is used only as a secondary exact-code identity cross-check (brand, original fragrance and gender) when the same Shobi code is present uniquely.

No product is automatically removed merely because it is missing from one scrape. Parser-loss guards reject suspicious snapshots instead of deleting catalogue data.

## Fragrantica enrichment

Fragrantica is an enrichment source, not the Shobi catalogue source. Exact Fragrantica pages may provide the canonical perfume link, bottle image and complete Top / Heart (Middle) / Base pyramid.

Automatic enrichment requires an exact Shobi-code identity plus a symmetric exact perfume-name match on the corresponding Fragrantica designer page. Extra or missing meaningful words are rejected, so a base fragrance can never silently match a flanker. Only complete structured Top / Heart / Base pyramids are accepted by the automatic new-entry pipeline. Existing verified pyramids and verified images are never overwritten by this automation.

When a Fragrantica identity, complete pyramid or image cannot be verified confidently, the official Shobi catalogue entry remains available but the uncertain enrichment is left unresolved rather than invented.

## Kaggle / Fragrantica.com Fragrance Dataset

Selected fragrance-note pyramids are also derived from Olga G's [Fragrantica.com Fragrance Dataset](https://www.kaggle.com/datasets/olgagmiufana1/fragrantica-com-fragrance-dataset), licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

The project uses only exact, unique brand-and-perfume matches with complete top, middle and base note groups. The source data is normalized into the project's JSON schema; existing verified pyramids are not overwritten. Each imported record retains its exact source URL, dataset attribution, license and validation version.

## Cross-verified Shobi note pyramids

Additional note pyramids are accepted only when an exact Shobi-code identity from the public [SmellyCat Shobi database](https://github.com/smellyCat-deep/shobi_inspiration) also has a unique exact brand-and-fragrance match in the [TidyTuesday Parfumo dataset](https://github.com/rfordatascience/tidytuesday/tree/main/data/2024/2024-12-10), and the top, heart and base groups strongly agree. Existing verified pyramids are never overwritten. Both provenance links and the validation version are stored with every accepted record.
