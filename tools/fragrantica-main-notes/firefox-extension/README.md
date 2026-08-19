# Shobi Fragrantica Main Notes Collector — Firefox

Temporary research extension for automating the first Shobi Best Seller batch directly inside a real Firefox session.

## What it does

- Opens Best Seller #1 through #10 one at a time in a dedicated tab.
- Injects the catcher into the Fragrantica page context at `document_start`.
- Waits for Fragrantica's global `_pd` decryptor and wraps it without replacing its behavior.
- Captures decoded Main Notes with rank, ingredient id, raw weight, percentage and pyramid level.
- Advances automatically after a successful capture.
- Downloads `shobi-fragrantica-bestsellers-1-10.json` when all 10 are finished.

## Temporary install in Firefox

1. Open `about:debugging`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on…**.
4. Select `manifest.json` from this folder.
5. Click the extension toolbar icon once to start the 1–10 batch.
6. Leave the collector tab open while it runs.

The extension is intentionally isolated under `tools/fragrantica-main-notes/` and does not modify the Shobi site or database.

## Current batch

The first version is intentionally hard-wired to `bestsellers-1-10` so we can validate the automated browser capture before generalizing it to arbitrary batches.
