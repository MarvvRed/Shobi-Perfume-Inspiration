# Shobi Master Database

Questa cartella è la **Single Source of Truth ufficiale** del catalogo Shobi per il progetto Shobi Perfume Inspiration.

## Baseline ufficiale

- `shobi-master-v1.csv` = baseline congelata del 2026-08-20.
- 2.343 veri profumi Shobi.
- Regola primaria ufficiale di identificazione: `Choose + Bottle + Extra Essence`.
- Segnale secondario ufficiale di conferma: appartenenza dello stesso `prestashop_product_id` alla categoria `/el/shobi`.
- Primary key: `prestashop_product_id`.

La categoria `/el/shobi` è più ampia del Master profumi: contiene prodotti Shobi che non sono necessariamente profumi configurabili. Per questo motivo **non viene usata da sola per classificare un profumo**. Viene usata come controllo indipendente: ogni prodotto certificato dalla regola primaria deve essere presente anche nella categoria ufficiale Shobi.

## Aggiornamento automatico

Il catalogo ufficiale viene controllato automaticamente tramite GitHub Actions, senza dipendere da sessioni manuali.

Workflow ufficiale:

`.github/workflows/sync-shobi-master-official.yml`

Script ufficiale:

`scripts/sync_shobi_master_official.py`

La pipeline:

1. legge il catalogo live `https://leparfum.com.gr/en/perfumes?resultsPerPage=99999`;
2. riconosce i veri profumi Shobi tramite la firma `Choose + Bottle + Extra Essence`;
3. estrae `prestashop_product_id` direttamente dalle card;
4. legge in una seconda navigazione indipendente `https://leparfum.com.gr/el/shobi?resultsPerPage=99999`;
5. estrae tutti gli ID della categoria ufficiale Shobi;
6. verifica che **ogni profumo certificato dalla firma primaria sia presente anche in `/el/shobi`**;
7. se anche un solo profumo certificato manca dalla categoria Shobi, interrompe la sync senza promuovere il candidato;
8. confronta il nuovo snapshot con il Master corrente;
9. classifica le differenze in `NEW`, `MODIFIED`, `REMOVED`;
10. applica gli altri safety checks prima di qualunque promozione;
11. aggiorna `shobi-master-current.csv` solo se tutti i controlli sono validi;
12. salva un report delle differenze in `reports/`;
13. non modifica mai `shobi-master-v1.csv`, che resta la baseline storica congelata.

## Doppia prova ufficiale

La classificazione ora usa due livelli distinti:

**Segnale primario — identificazione del profumo**

`/en/perfumes` + firma `Choose + Bottle + Extra Essence`

**Segnale secondario — conferma di appartenenza Shobi**

`prestashop_product_id ∈ /el/shobi`

Il secondo controllo non allarga il Master e non trasforma automaticamente tutti i prodotti di `/el/shobi` in profumi. Serve esclusivamente a confermare, con una fonte indipendente del sito ufficiale, i prodotti già identificati dalla firma del configuratore.

Il report JSON della sync registra anche:

- `secondary_source_url`
- `shobi_category_products`
- `shobi_category_extra_products`
- `shobi_category_missing_perfumes`
- `secondary_validation_rule`

## Regola di sicurezza

Se la struttura del sito cambia, se la firma Shobi non viene più trovata, se gli ID diventano duplicati/mancanti, se `/el/shobi` non viene caricato correttamente, se un profumo certificato dalla firma primaria non appartiene alla categoria Shobi o se il numero di prodotti cambia in modo anomalo, la pipeline deve **fallire senza aggiornare il Master**.

I prefissi (`WP`, `MP`, `EL`, `AR`, `LUX`, `MIX`, `UAE`, ecc.) sono segnali secondari e non vengono usati come condizione necessaria per identificare un vero Shobi.

Vedi anche `CHECKPOINT-MASTER-V1.md` per il checkpoint ufficiale che ha istituito questa baseline.
