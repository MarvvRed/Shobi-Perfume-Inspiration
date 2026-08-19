# Shobi Fragrantica Main Notes — Local One Click

Questa è la via locale semplice per catturare automaticamente i Main Notes dei Best Seller #1-#10 usando la connessione del PC.

## Uso

1. Scarica/aggiorna la repo sul PC.
2. Vai in `tools\fragrantica-main-notes\local-one-click`.
3. Fai doppio clic su `run.cmd`.
4. Al primo avvio il tool prepara da solo Node portable se necessario e installa `playwright-core`.
5. Si apre Microsoft Edge e il tool visita automaticamente i 10 URL Fragrantica del batch.
6. Il risultato viene salvato in `results\bestsellers-1-10.json` e aperto in Blocco note.

Non servono GitHub Actions, self-hosted runner, DevTools, console o estensioni Firefox.

## Note

- La cattura intercetta `_pd` prima degli script della pagina tramite `addInitScript`, quindi legge il payload Main Notes già decifrato.
- Ogni profumo ha un timeout locale e i risultati vengono salvati dopo ogni target, quindi un errore non cancella i successi precedenti.
- Il browser gira localmente dal PC dell'utente e quindi usa la normale connessione domestica, non un IP di datacenter GitHub.
