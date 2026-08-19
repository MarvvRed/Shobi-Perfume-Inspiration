#!/usr/bin/env python3
import json
import re
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DETAILS = ROOT / "Personal Database" / "perfume-details.json"
BESTSELLER_FILES = [ROOT / f"bestsellers-{i}.js" for i in range(1, 6)]
AUDIT_OUT = ROOT / "bestseller-notes-audit.json"
VERIFIED_OUT = ROOT / "bestseller-notes-verified.json"

TARGET_START = 21
TARGET_END = 100


def normalize_code(value):
    return str(value or "").strip().lower()


def is_verified(record):
    if not isinstance(record, dict):
        return False
    if record.get("notes_verified") is True:
        return True
    status = str(record.get("notes_status") or "").strip().lower()
    return bool(status) and "verified" in status and "pending" not in status and "unverified" not in status


def unique(values):
    seen = set()
    out = []
    for value in values or []:
        text = str(value or "").strip()
        key = text.casefold()
        if text and key not in seen:
            seen.add(key)
            out.append(text)
    return out


def extract_ranking():
    codes = []
    pattern = re.compile(r'"([^"]+)"')
    for path in BESTSELLER_FILES:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        codes.extend(pattern.findall(text))
    if len(codes) < TARGET_END:
        raise SystemExit(f"Only {len(codes)} bestseller codes found; expected at least {TARGET_END}")
    return codes


def main():
    if not DETAILS.exists():
        raise SystemExit(f"Missing read-only source: {DETAILS}")

    ranking = extract_ranking()
    details = json.loads(DETAILS.read_text(encoding="utf-8"))

    verified = {}
    rows = []
    target_codes = ranking[TARGET_START - 1:TARGET_END]

    for rank, code in enumerate(target_codes, start=TARGET_START):
        key = normalize_code(code)
        record = details.get(key)
        state = "missing"
        top = heart = base = []
        source = source_url = notes_status = ""
        validation_version = None

        if isinstance(record, dict):
            notes_status = str(record.get("notes_status") or "")
            validation_version = record.get("notes_validation_version")
            source = str(record.get("notes_source") or "")
            source_url = str(record.get("notes_source_url") or "")
            if is_verified(record):
                top = unique(record.get("top_notes"))
                heart = unique(record.get("heart_notes"))
                base = unique(record.get("base_notes"))
                state = "verified" if (top or heart or base) else "verified_empty"
            else:
                state = "pending" if record else "missing"

        if state == "verified":
            verified[code] = {
                "rank": rank,
                "top_notes": top,
                "heart_notes": heart,
                "base_notes": base,
                "notes_source": source,
                "notes_source_url": source_url,
                "notes_status": notes_status,
                "notes_validation_version": validation_version,
            }

        rows.append({
            "rank": rank,
            "code": code,
            "state": state,
            "notes_status": notes_status,
            "notes_validation_version": validation_version,
        })

    counts = {
        "total": len(rows),
        "verified": sum(r["state"] == "verified" for r in rows),
        "pending": sum(r["state"] == "pending" for r in rows),
        "missing": sum(r["state"] == "missing" for r in rows),
        "verified_empty": sum(r["state"] == "verified_empty" for r in rows),
    }

    generated = datetime.now(timezone.utc).isoformat()
    audit = {
        "scope": "Best Seller #21-#100",
        "generated_at": generated,
        "source": "Personal Database/perfume-details.json (read-only)",
        "counts": counts,
        "records": rows,
    }
    payload = {
        "scope": "Best Seller #21-#100",
        "generated_at": generated,
        "source": "Personal Database/perfume-details.json (read-only; verified records only)",
        "perfumes": verified,
    }

    AUDIT_OUT.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    VERIFIED_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"TOTAL={counts['total']}")
    print(f"VERIFIED={counts['verified']}")
    print(f"PENDING={counts['pending']}")
    print(f"MISSING={counts['missing']}")
    print(f"VERIFIED_EMPTY={counts['verified_empty']}")
    print("UNRESOLVED=" + ",".join(r["code"] for r in rows if r["state"] != "verified"))


if __name__ == "__main__":
    main()
