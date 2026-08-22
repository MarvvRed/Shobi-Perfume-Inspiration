#!/usr/bin/env python3
"""Build the canonical Fragrantica Notes Database from the public /notes/ page.

Authority: https://www.fragrantica.com/notes/

Outputs:
- Fragrantica Notes Database/fragrantica-notes.json
- fragrantica-notes-database.js (browser registry; backwards compatible with FRAGRANTICA_NOTE_ICON_IDS)

Also audits every Main Note used by the frozen canonical Top100 and fails if any
canonical note cannot be resolved exactly (case-insensitive) in the full registry.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://www.fragrantica.com/notes/"
OUT_DIR = ROOT / "Fragrantica Notes Database"
OUT_JSON = OUT_DIR / "fragrantica-notes.json"
OUT_JS = ROOT / "fragrantica-notes-database.js"
TOP100 = ROOT / "Fragrantica ID Database" / "rebuild-top100" / "top100-fragrantica-mapped.json"

NOTE_HREF_RE = re.compile(r"^/notes/(.+)-(\d+)\.html(?:[?#].*)?$", re.I)


class NotesParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.current_category = "UNCATEGORIZED"
        self._capture_h2 = False
        self._h2_parts: list[str] = []
        self._pending_note: tuple[str, int, str] | None = None
        self._note_text: list[str] = []
        self.notes: list[dict] = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag.lower() == "h2":
            self._capture_h2 = True
            self._h2_parts = []
            return
        if tag.lower() != "a":
            return
        href = (attrs.get("href") or "").strip()
        m = NOTE_HREF_RE.match(href)
        if not m:
            return
        note_id = int(m.group(2))
        self._pending_note = (href, note_id, self.current_category)
        self._note_text = []

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "h2" and self._capture_h2:
            text = " ".join("".join(self._h2_parts).split()).strip()
            if text:
                self.current_category = text
            self._capture_h2 = False
        elif tag == "a" and self._pending_note:
            name = " ".join("".join(self._note_text).split()).strip()
            href, note_id, category = self._pending_note
            if name:
                self.notes.append({
                    "name": name,
                    "id": note_id,
                    "category": category,
                    "url": "https://www.fragrantica.com" + href.split("?", 1)[0].split("#", 1)[0],
                    "icon_url": f"https://fimgs.net/mdimg/sastojci/m.{note_id}.jpg",
                })
            self._pending_note = None
            self._note_text = []

    def handle_data(self, data):
        if self._capture_h2:
            self._h2_parts.append(data)
        if self._pending_note:
            self._note_text.append(data)


def fetch_source() -> str:
    req = Request(
        SOURCE_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", errors="replace")


def dedupe(notes: list[dict]) -> list[dict]:
    # Same note link can appear more than once in page markup. ID is canonical identity.
    by_id: dict[int, dict] = {}
    for row in notes:
        old = by_id.get(row["id"])
        if old and old["name"] != row["name"]:
            raise SystemExit(f"Conflicting names for Fragrantica note ID {row['id']}: {old['name']!r} vs {row['name']!r}")
        by_id[row["id"]] = row
    return sorted(by_id.values(), key=lambda r: r["id"])


def audit_top100(notes: list[dict]) -> tuple[int, list[str]]:
    if not TOP100.exists():
        raise SystemExit(f"Missing canonical Top100: {TOP100}")
    data = json.loads(TOP100.read_text(encoding="utf-8"))
    records = data.get("records", [])
    canonical_names = sorted({str(n).strip() for r in records for n in r.get("main_notes", []) if str(n).strip()}, key=str.casefold)
    registry = {r["name"].casefold(): r for r in notes}
    missing = [name for name in canonical_names if name.casefold() not in registry]
    return len(canonical_names), missing


def write_outputs(notes: list[dict], top100_unique: int, missing: list[str]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    categories: dict[str, int] = {}
    for n in notes:
        categories[n["category"]] = categories.get(n["category"], 0) + 1

    payload = {
        "schema_version": 1,
        "database": "Fragrantica Notes Database",
        "authority": SOURCE_URL,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "note_count": len(notes),
        "category_count": len(categories),
        "categories": categories,
        "top100_unique_main_notes": top100_unique,
        "top100_missing_note_icons": missing,
        "top100_note_icon_coverage": f"{top100_unique-len(missing)}/{top100_unique}",
        "notes": notes,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Browser registry. Keep the existing FRAGRANTICA_NOTE_ICON_IDS API so the
    # current renderer needs no data migration.
    by_name = {n["name"]: str(n["id"]) for n in sorted(notes, key=lambda x: x["name"].casefold())}
    db_by_lower = {n["name"].casefold(): n for n in notes}
    js = (
        "// GENERATED from https://www.fragrantica.com/notes/ — DO NOT HAND EDIT.\n"
        "window.FRAGRANTICA_NOTES_DATABASE=" + json.dumps(db_by_lower, ensure_ascii=False, separators=(",", ":")) + ";\n"
        "window.FRAGRANTICA_NOTE_ICON_IDS=" + json.dumps(by_name, ensure_ascii=False, separators=(",", ":")) + ";\n"
        f"window.FRAGRANTICA_NOTE_DATABASE_META={{source:{json.dumps(SOURCE_URL)},count:{len(notes)},top100_coverage:{json.dumps(payload['top100_note_icon_coverage'])}}};\n"
    )
    OUT_JS.write_text(js, encoding="utf-8")


def main() -> int:
    html = fetch_source()
    parser = NotesParser()
    parser.feed(html)
    notes = dedupe(parser.notes)
    if len(notes) < 500:
        raise SystemExit(f"Safety stop: only {len(notes)} note links parsed from Fragrantica /notes/; refusing to publish incomplete registry")

    top100_unique, missing = audit_top100(notes)
    write_outputs(notes, top100_unique, missing)

    print(f"FRAGRANTICA_NOTES_DATABASE={len(notes)}")
    print(f"FRAGRANTICA_NOTES_CATEGORIES={len({n['category'] for n in notes})}")
    print(f"TOP100_UNIQUE_MAIN_NOTES={top100_unique}")
    print(f"TOP100_NOTE_ICON_COVERAGE={top100_unique-len(missing)}/{top100_unique}")
    if missing:
        print("TOP100_MISSING_NOTE_ICONS=" + json.dumps(missing, ensure_ascii=False))
        return 1
    print("TOP100_MISSING_NOTE_ICONS=0")
    return 0


if __name__ == "__main__":
    sys.exit(main())
