#!/usr/bin/env python3
"""Builds tokens/theme.css from tokens/tokens.json. Standard library only."""
from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tokens" / "tokens.json"
DEST = ROOT / "tokens" / "theme.css"
REFERENCE = re.compile(r"^\{([\w.-]+)\}$")


def main():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    resolved = {}
    items = {}
    for family, group in data.items():
        if family.startswith("$"):
            continue
        if not isinstance(group, dict):
            raise ValueError(f"Expected object in {family}")
        for name, value in group.items():
            if not isinstance(value, str):
                raise ValueError(f"Expected string for {family}.{name}")
            items[f"{family}.{name}"] = value

    def resolve(key, trail=()):
        if key in resolved:
            return resolved[key]
        if key not in items:
            raise ValueError(f"Undefined reference: {key}")
        if key in trail:
            raise ValueError(f"Cyclic token reference: {' > '.join((*trail, key))}")
        value = items[key]
        m = REFERENCE.fullmatch(value)
        if m:
            value = resolve(m.group(1), (*trail, key))
        resolved[key] = value
        return value

    lines = [
        "/* GENERATED FILE — edit tokens/tokens.json, then run python3 scripts/build_tokens.py */",
        f"/* System: {data.get('$meta', {}).get('system', 'Iwagé')} | version {data.get('$meta', {}).get('version', 'unknown')} */",
        ":root {",
    ]
    for family, group in data.items():
        if family.startswith("$"):
            continue
        lines.append(f"  /* {family} */")
        for name in group:
            lines.append(f"  --iw-{family}-{name}: {resolve(family + '.' + name)};")
    lines += ["}", ""]
    DEST.write_text("\n".join(lines), encoding="utf-8")
    print(f"Generated {DEST.relative_to(ROOT)} with {len(items)} variables.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
