# Shobi Catalog Extractor

Questa cartella conserva la regola verificata per distinguere i veri profumi Shobi dai prodotti originali di marchi esterni presenti nel catalogo `/en/perfumes`.

## Regola Shobi v1

Un prodotto viene classificato come **vero profumo Shobi** quando, nello snapshot live della pagina `https://leparfum.com.gr/en/perfumes`, presenta contemporaneamente la struttura del configuratore Shobi:

- `Choose`
- `Bottle`
- `Extra Essence`

Nel DOM corrente questa struttura è osservabile anche negli URL/configurazioni prodotto, ad esempio con segmenti equivalenti a:

`choose-eau_de_parfum / bottle-30ml / extra_essence-0ml`

## Cosa NON usare come criterio primario

Non classificare un prodotto come Shobi soltanto in base a:

- prefisso della reference (`WP`, `MP`, `EL`, `AR`, `LUX`, `MIX`, `UAE`, ecc.);
- nome o codice prodotto;
- testo `Inspired by`, `Type`, `Dupe` o simili;
- prezzo `From`;
- categoria del sito;
- assenza/presenza di un brand esterno nel nome.

Questi elementi possono essere usati come segnali secondari e controlli di anomalia, ma non sono la firma primaria.

## Validazione snapshot

Snapshot live analizzato: pagina `Perfumes` con **2.562 prodotti**.

Risultato della classificazione:

- **2.343** veri profumi Shobi: `Choose + Bottle + Extra Essence`;
- **196** prodotti finiti/originali esterni senza configuratore Shobi;
- **23** prodotti configurabili `Home Fragrances`, esclusi perché non sono profumi personali e non presentano la firma completa `Bottle + Extra Essence`.

Famiglie reference osservate nei 2.343 profumi Shobi dello snapshot:

- `WP`: 853
- `AR`: 610
- `EL`: 449
- `MP`: 381
- `LUX`: 40
- `MIX`: 8
- `UAE`: 2

Questi prefissi **non vanno hardcodati come condizione necessaria**: un futuro nuovo prefisso Shobi deve poter essere riconosciuto tramite la firma del configuratore.

## Procedura per gli aggiornamenti futuri

1. Aprire `/en/perfumes` sul sito ufficiale.
2. Caricare `Show all` per ottenere uno snapshot coerente della sessione live.
3. Estrarre il DOM corrente completo.
4. Identificare i prodotti che soddisfano la Regola Shobi v1.
5. Costruire il catalogo Shobi estratto.
6. Confrontarlo con lo snapshot/catalogo precedente.
7. Segnalare separatamente `NEW`, `MODIFIED` e `REMOVED`.
8. Controllare manualmente ogni anomalia prima di aggiornare il database ufficiale.

## Principio di sicurezza dati

La regola è **verificata sull'intero snapshot corrente**, ma non va considerata immutabile per sempre. Se Shobi modifica la struttura del sito o del configuratore, il classificatore deve fermarsi/segnalare anomalie e la regola deve essere nuovamente validata prima di aggiornare il database.

Obiettivo: mantenere un catalogo Shobi riproducibile e aggiornabile partendo esclusivamente da dati live verificabili, senza supposizioni manuali.
