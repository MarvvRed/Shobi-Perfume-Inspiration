# CHECKPOINT — OFFICIAL MASTER → SITE INTEGRATION v1

**Data:** 2026-08-21

## Punto di svolta

Questo checkpoint segna il passaggio definitivo del sito **Shobi Perfume Inspiration** da un catalogo autonomo/legacy a un catalogo governato dallo **Shobi Master Database ufficiale**.

Da questo punto in avanti:

- `Shobi Master Database/shobi-master-current.csv` decide **quali prodotti Shobi esistono**;
- `prestashop_product_id` è l'identità tecnica ufficiale anche per la pipeline del sito;
- il file pubblico `shobi-master.csv` è un **dataset derivato**, costruito dal Master e arricchito con i dati del sito;
- un prodotto non presente nel Master non può rimanere nel catalogo pubblico solo perché esisteva nel vecchio dataset;
- il sito conserva gli enrichment disponibili (brand, Fragrantica, note, immagini, stagioni ecc.) senza permettere a tali dati di ridefinire l'identità del catalogo.

## Promozione verificata

Il primo passaggio in produzione è stato completato automaticamente con commit GitHub Actions:

- `fae6feb` — **Promote official Shobi Master catalog to site**

La pipeline di produzione è stata poi consolidata usando direttamente `prestashop_product_id` per i rebuild successivi. L'ultima verifica stabile del checkpoint ha prodotto:

- Master: **2.343** righe;
- sito corrente: **2.343** righe;
- candidate: **2.343** righe;
- `existing_pid_matches`: **2.343/2.343**;
- set `prestashop_product_id`: **match esatto**;
- `prestashop_product_id` duplicati: **0**;
- righe renderizzabili: **2.343/2.343**;
- URL Shobi mancanti: **0**;
- gender mancanti: **0**;
- ambiguità: **0**;
- safety: **PASS**.

## Enrichment

Al momento del primo switch:

- **2.317/2.343** prodotti avevano enrichment recuperabile dal vecchio catalogo;
- **26** prodotti ufficiali erano privi di enrichment legacy sicuro e sono stati mantenuti come righe minime ufficiali, senza inventare dati;
- copertura enrichment ricco: **98,8903%**.

Il vecchio catalogo ricco pre-Master è stato conservato come backup forense immutabile:

`Shobi Master Database/site-enrichment-seed-v1.csv`

Questo file **non è una fonte di identità**; può essere usato solo come fallback di enrichment per prodotti nuovi/non ancora arricchiti.

## Frontend identity

È stato corretto anche il frontend: favorites e modal non dipendono più dal solo `shobi_code`, perché il catalogo ufficiale contiene almeno un codice display duplicato (`777-LAL WP`).

Il frontend usa ora:

1. `prestashop_product_id` come identità primaria;
2. il vecchio codice solo come fallback di compatibilità;
3. migrazione automatica dei favorites salvati nel vecchio formato.

Questo evita collisioni tra prodotti distinti che condividono lo stesso codice visualizzato.

## Pipeline automatica ufficiale

La catena completa diventa:

`Windows Task Scheduler → Firefox autorizzato → snapshot Shobi live → GitHub → validazione Master → shobi-master-current.csv → builder sito → regression audit → production gate → shobi-master.csv → GitHub Pages`

Il workflow `Build Site Catalog From Official Master`:

1. costruisce il candidate dal Master;
2. conserva/riusa gli enrichment per `prestashop_product_id`;
3. per un nuovo ID prova soltanto fallback legacy deterministici;
4. lascia una riga minima ufficiale se non esiste enrichment sicuro;
5. blocca la pubblicazione in presenza di ambiguità;
6. esegue il regression audit;
7. verifica nuovamente il set degli ID prima della promozione;
8. sostituisce `shobi-master.csv` solo se tutti i gate passano.

## Regole congelate

1. Il Master è l'unica autorità sull'appartenenza al catalogo.
2. `shobi-master.csv` è output del sistema, non una source of truth indipendente.
3. `prestashop_product_id` è la chiave di identità ufficiale dall'acquisizione fino al frontend.
4. Nessun match di enrichment ambiguo può essere forzato.
5. Un prodotto ufficiale senza enrichment deve restare visibile con i soli dati certi del Master.
6. Il seed legacy non può reintrodurre prodotti assenti dal Master.
7. Se builder, regression audit o production gate falliscono, il catalogo pubblico precedente resta invariato.
8. Il flusso automatico deve essere rivalidato se cambia la struttura fondamentale del sito Shobi o del frontend.

## Significato del checkpoint

Il progetto dispone ora di una singola catena di autorità dati dal sito ufficiale Shobi fino al catalogo pubblico del progetto.

**Master ufficiale, catalogo del sito e aggiornamento automatico non sono più sistemi separati.**

Questo checkpoint non deve essere reinterpretato o sostituito nei lavori successivi senza una nuova validazione end-to-end e una decisione esplicita di versione.
