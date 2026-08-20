# CHECKPOINT — SHOBI MASTER DATABASE v1

**Data:** 2026-08-20

## Punto di svolta del progetto

Questo checkpoint segna il passaggio da liste Shobi ricostruite o inferite a un **catalogo master ufficiale, verificabile e aggiornabile da snapshot live del sito ufficiale**.

Da questo punto in avanti, `Shobi Master Database/shobi-master-v1.csv` è la **Single Source of Truth del catalogo Shobi** per il progetto Shobi Perfume Inspiration.

## Stato congelato

- Snapshot live `/en/perfumes`: **2.562 prodotti**.
- Veri profumi Shobi classificati: **2.343**.
- Prodotti esclusi/non-Shobi/non-profumi personali: **219**.
- Regola ufficiale di identificazione Shobi: **`Choose + Bottle + Extra Essence`**.
- Primary key ufficiale: **`prestashop_product_id`**.
- `prestashop_product_id`: **2.343/2.343 presenti, 2.343/2.343 unici, 0 duplicati**.
- URL: **2.343/2.343 unici**.
- Validazione live ID listing ↔ scheda individuale: **200/200 match, 0 anomalie**, con campione distribuito lungo il catalogo.
- Le `reference` non sono considerate primary key perché presentano duplicati reali.

## Regole da questo checkpoint in avanti

1. Il Master stabilisce quali prodotti appartengono al catalogo Shobi del progetto.
2. Gli altri dataset (Best Sales, note, performance, ranking, evidenze, ecc.) devono collegarsi al Master invece di mantenere una propria definizione indipendente del catalogo.
3. `shobi-master-v1.csv` resta congelato come baseline storica v1.
4. Gli aggiornamenti futuri devono partire da un nuovo snapshot live coerente.
5. Il nuovo snapshot deve essere classificato con la firma Shobi e confrontato tramite `prestashop_product_id` con il Master precedente.
6. Le differenze devono essere separate in `NEW`, `MODIFIED` e `REMOVED`.
7. Nessuna nuova versione del Master viene promossa senza audit delle anomalie.
8. Se Shobi modifica la struttura del sito/configuratore, il processo deve fermarsi e la regola di classificazione deve essere rivalidata prima di aggiornare il Master.
9. I campi non ricavabili con certezza non vengono indovinati: restano vuoti fino a prova verificabile.

## Significato del checkpoint

Prima di questo checkpoint il problema principale era stabilire con certezza quali elementi del catalogo misto del sito fossero veri profumi Shobi.

Dopo questo checkpoint disponiamo di:

- una firma positiva verificata per riconoscere i veri profumi Shobi;
- una chiave tecnica univoca per seguirli nel tempo;
- un Master iniziale completo da 2.343 record;
- una procedura ripetibile per individuare nuovi, modificati e rimossi;
- una baseline versionata su GitHub.

**Questo checkpoint non va reinterpretato o ricostruito da zero nei lavori successivi: è la baseline ufficiale del catalogo Shobi Master v1.**
