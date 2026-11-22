#!/usr/bin/env python3
"""Non-destructive style audit: raw HEX codes and ad-hoc font declarations.

Run: python3 scripts/audit_styles.py src app components
Outputs findings, not automatic failures (illustration SVGs and semantic assets can be valid).
"""
from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parents[1]
HEX = re.compile(r"(?<![\w-])#[\da-fA-F]{3,8}\b")
FONT = re.compile(r"\bfont-family\s*:\s*(?!var\s*\()[^;\n]+", re.I)
EXT = {".css", ".scss", ".sass", ".html", ".jsx", ".tsx", ".js", ".ts", ".vue", ".svelte"}
SKIP = {"node_modules", "dist", "build", ".git", ".next", ".astro", "coverage"}


def files(path):
    if path.is_file():
        yield path
    elif path.is_dir():
        for p in path.rglob("*"):
            if p.is_file() and not set(p.parts).intersection(SKIP):
                yield p


def main(paths):
    if not paths:
        print("Usage: python3 scripts/audit_styles.py <source-directory> [more...]\nNo source paths provided; no files inspected.")
        return
    total = 0
    for raw in paths:
        target = Path(raw)
        if not target.exists():
            print(f"Missing path: {raw}")
            continue
        for file in files(target):
            if file.suffix.lower() not in EXT or file.resolve() == (ROOT / "tokens/theme.css").resolve():
                continue
            try:
                content = file.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            for n, line in enumerate(content.splitlines(), 1):
                hits = []
                hits.extend("hex:" + h for h in HEX.findall(line))
                if FONT.search(line):
                    hits.append("font-family ad hoc")
                if hits:
                    print(f"{file}:{n}: {', '.join(hits)}")
                    total += 1
    print(f"\nReview {total} findings. These are warnings, not definitive failures.")


if __name__ == "__main__":
    main(sys.argv[1:])
