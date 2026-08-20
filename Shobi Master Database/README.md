# Shobi Master Database

Catalogo master dei veri profumi Shobi estratti dallo snapshot live completo della pagina `/en/perfumes`.

## Versione iniziale

- Snapshot: 2026-08-20
- Prodotti presenti nella pagina Show All: 2.562
- Veri profumi Shobi inclusi nel Master: 2.343
- Regola di classificazione: `Choose + Bottle + Extra Essence`
- Primary key: `prestashop_product_id`
- `prestashop_product_id`: 2.343/2.343 presenti, 2.343/2.343 unici, 0 duplicati

## Principi

Il Master include soltanto prodotti che superano la firma tecnica Shobi verificata. I prefissi reference (`WP`, `AR`, `EL`, `MP`, `LUX`, `MIX`, `UAE`) non sono usati come condizione primaria.

`prestashop_product_id` identifica il record tecnico del prodotto ed è la primary key del Master. `reference`, nome, URL e categoria sono attributi e possono cambiare o non essere univoci.

I campi non ricavabili con certezza dai dati ufficiali non vengono inventati: rimangono vuoti in attesa di verifica.

## File

- `shobi-master-v1.csv` — catalogo master completo, 2.343 record.
- `shobi-master-v1-audit.txt` — audit della generazione iniziale.

La metodologia e la regola di estrazione sono documentate separatamente nella cartella `Shobi Catalog Extractor`.
