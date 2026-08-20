# Shobi Master Local Agent (Windows)

This is the official acquisition path when GitHub-hosted runners are blocked by leparfum.com.gr.

Flow:

Windows authorized Firefox -> live XHR capture -> compact validated incoming JSON -> git push -> GitHub offline validation -> Shobi Master promotion.

## One-time setup

Requirements:
- Windows PC
- Firefox installed
- Python 3 available through `py -3`
- Git installed and authenticated for this repository

From the repository root:

```powershell
git pull --ff-only
py -3 -m pip install -r local-agent\requirements.txt
py -3 local-agent\shobi_local_capture.py --setup
```

A dedicated Firefox profile is stored locally at:

`%LOCALAPPDATA%\ShobiMasterAgent\firefox-profile`

If Shobi shows browser verification during the first setup run, complete it in the opened Firefox window, return to the terminal and press ENTER. No cookies are stored in GitHub.

After a successful setup capture, test the complete push path:

```powershell
local-agent\run_capture.cmd
```

A successful capture writes only this compact source snapshot:

`Shobi Master Database/incoming/shobi-live-latest.json`

The local safety checks require:
- at least 2400 total `/en/perfumes` cards;
- at least 2200 signature-certified Shobi perfumes;
- unique non-empty `prestashop_product_id` values;
- at least 3000 unique `/el/shobi` product IDs;
- every signature-certified perfume ID must also be present in `/el/shobi`.

GitHub then independently revalidates the incoming snapshot using:

`.github/workflows/process-shobi-incoming.yml`

and:

`scripts/process_shobi_incoming.py`

The frozen baseline `shobi-master-v1.csv` is never modified.

## Weekly automation

Open PowerShell from the repository and run:

```powershell
powershell -ExecutionPolicy Bypass -File local-agent\install_windows_task.ps1
```

This installs the Windows scheduled task:

`Shobi Master Weekly Capture`

Schedule: Monday at 23:00 local time.

`StartWhenAvailable` is enabled. If the PC is off at 23:00, Windows runs the missed task when the machine becomes available again while the user session is active.

## Security

The Shobi browser session stays only inside the dedicated local Firefox profile. The repository receives catalog data only. No Shobi cookies or browser credentials are committed.
