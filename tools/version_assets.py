"""Refresh content fingerprints after editing a static asset; no build step required."""

import hashlib
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
ASSET = re.compile(r'((?:src|href)=")([^"?:]+\.(?:js|css|svg))(?:\?[^" ]*)?"')


def stamp(match):
    asset = ROOT / match[2]
    if asset.name == "map-config.js":
        return f'{match[1]}{match[2]}"'
    if not asset.is_file():
        return match[0]
    digest = hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
    return f'{match[1]}{match[2]}?v={digest}"'


if __name__ == "__main__":
    for name in ("index.html", "detail.html", "feedback.html"):
        page = ROOT / name
        original = page.read_text(encoding="utf-8")
        updated = ASSET.sub(stamp, original)
        if updated != original:
            page.write_text(updated, encoding="utf-8")
            print(f"Updated {name}")
