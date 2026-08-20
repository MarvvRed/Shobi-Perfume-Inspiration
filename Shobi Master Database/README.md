# Shobi Master Database

Questa cartella è la **Single Source of Truth ufficiale** del catalogo Shobi per il progetto Shobi Perfume Inspiration.

## Baseline ufficiale

- `shobi-master-v1.csv` = baseline congelata del 2026-08-20.
- 2.343 veri profumi Shobi.
- Regola ufficiale di identificazione: `Choose + Bottle + Extra Essence`.
- Primary key: `prestashop_product_id`.

## Aggiornamento automatico

Il catalogo ufficiale viene controllato automaticamente tramite GitHub Actions, senza dipendere da browser, Show All, console o sessioni manuali.

Workflow ufficiale:

`.github/workflows/sync-shobi-master-official.yml`

Script ufficiale:

`scripts/sync_shobi_master_official.py`

La pipeline:

1. legge direttamente tutte le pagine live di `https://leparfum.com.gr/en/perfumes`;
2. riconosce i veri profumi Shobi tramite la firma `Choose + Bottle + Extra Essence`;
3. estrae `prestashop_product_id` direttamente dalle card;
4. confronta il nuovo snapshot con il Master corrente;
5. classifica le differenze in `NEW`, `MODIFIED`, `REMOVED`;
6. applica safety checks prima di qualunque promozione;
7. aggiorna `shobi-master-current.csv` solo se il controllo è valido;
8. salva un report delle differenze in `reports/`;
9. non modifica mai `shobi-master-v1.csv`, che resta la baseline storica congelata.

## Regola di sicurezza

Se la struttura del sito cambia, se la firma Shobi non viene più trovata, se gli ID diventano duplicati/mancanti o se il numero di prodotti cambia in modo anomalo, la pipeline deve **fallire senza aggiornare il Master**.

I prefissi (`WP`, `MP`, `EL`, `AR`, `LUX`, `MIX`, `UAE`, ecc.) sono segnali secondari e non vengono usati come condizione necessaria per identificare un vero Shobi.

Vedi anche `CHECKPOINT-MASTER-V1.md` per il checkpoint ufficiale che ha istituito questa baseline.
