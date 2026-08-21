# CHECKPOINT — SHOBI MASTER AUTOMATION v1

**Data:** 2026-08-21

## Checkpoint fondamentale del progetto

Questo checkpoint segna il completamento e la verifica end-to-end dell'automazione ufficiale di aggiornamento dello **Shobi Master Database**.

Da questo punto in avanti il controllo periodico del catalogo Shobi non richiede più un'acquisizione manuale: il PC Windows autorizzato esegue la cattura tramite Firefox dedicato, pubblica lo snapshot nella repository e GitHub valida il risultato prima di qualsiasi promozione del Master.

## Architettura ufficiale congelata

`Windows Task Scheduler → Firefox dedicato autorizzato → XHR live Shobi → snapshot incoming → git push → GitHub Actions → validazione offline → confronto con shobi-master-current.csv → eventuale promozione`

### Componenti

- Task Windows: **`Shobi Master Weekly Capture`**.
- Frequenza: **ogni lunedì alle 23:00, ora locale**.
- `StartWhenAvailable`: **abilitato**, per recuperare l'esecuzione quando il PC torna disponibile.
- Runner locale: `local-agent/run_capture.cmd`.
- Browser: profilo Firefox dedicato e persistente sul PC locale.
- Snapshot pubblicato: `Shobi Master Database/incoming/shobi-live-latest.json`.
- Workflow GitHub: **Process Local Shobi Snapshot**.
- Master operativo: `Shobi Master Database/shobi-master-current.csv`.
- Baseline storica v1: `Shobi Master Database/shobi-master-v1.csv`, che resta congelata.

## Validazioni completate

La catena è stata verificata realmente, non solo configurata.

### Acquisizione live stabile

- `/en/perfumes`: **2.562 prodotti**.
- Veri profumi Shobi: **2.343**.
- `/el/shobi`: **3.551 prodotti**.
- Extra nella categoria `/el/shobi`: **1.208**.
- Veri profumi Shobi mancanti da `/el/shobi`: **0**.
- Regola primaria: **`Choose + Bottle + Extra Essence`**.
- Validazione secondaria: **`prestashop_product_id` presente in `/el/shobi`**.
- Primary key: **`prestashop_product_id`**.

### Test di stabilità

Dopo l'allineamento iniziale degli URL è stata eseguita una seconda cattura consecutiva con risultato:

- `new: 0`
- `modified: 0`
- `removed: 0`
- `changed: false`
- `safety: PASS`

Questo conferma che la pipeline non genera falsi cambiamenti su due acquisizioni equivalenti.

### Test reale del Task Scheduler

Il task **`Shobi Master Weekly Capture`** è stato avviato manualmente tramite Windows Task Scheduler senza aprire manualmente Firefox o GitHub Desktop.

Risultato Windows:

- `LastTaskResult: 0`
- esecuzione completata autonomamente;
- Firefox dedicato aperto e chiuso automaticamente;
- snapshot catturato e inviato a GitHub.

Il test ha prodotto il commit locale/push:

- `a75e0cc` — **Capture Shobi live snapshot 2026-08-21 02:06**

GitHub Actions ha quindi elaborato automaticamente lo snapshot e prodotto:

- `91d2b8f` — **Process validated local Shobi snapshot 2026-08-21**

Poiché il catalogo non presentava cambiamenti reali, il Master non è stato modificato: è stato aggiornato soltanto il report dell'ultima verifica.

## Regole operative da questo checkpoint in avanti

1. **Non è richiesto intervento manuale per il controllo settimanale ordinario.**
2. GitHub Desktop non è una dipendenza dell'automazione e può essere chiuso.
3. Il sito Shobi viene interrogato dal PC autorizzato, non dai runner GitHub che risultano bloccati dal sito.
4. GitHub Actions non acquisisce direttamente il catalogo live: valida e processa lo snapshot ricevuto dal local agent.
5. Il Master viene modificato solo dopo il superamento dei safety checks.
6. `shobi-master-v1.csv` resta immutabile come baseline storica.
7. `shobi-master-current.csv` rappresenta il catalogo operativo corrente.
8. In assenza di cambiamenti reali, il Master non deve essere riscritto/promosso inutilmente.
9. In presenza di `NEW`, `MODIFIED` o `REMOVED`, il workflow deve produrre report/diff verificabili.
10. Se la cattura, la firma Shobi, la categoria di controllo o i safety checks diventano incoerenti, la pipeline deve fermarsi invece di promuovere dati sospetti.

## Significato del checkpoint

Il progetto dispone ora non soltanto di un catalogo Master ufficiale, ma di una **catena automatica, ripetibile, versionata e testata end-to-end per mantenerlo aggiornato**.

Questo è il passaggio dal **Master statico verificato** al **Master mantenuto automaticamente sotto controllo**.

**Questo checkpoint è fondamentale e non deve essere reinterpretato o sostituito nei lavori successivi senza una nuova decisione esplicita e una nuova validazione end-to-end.**
