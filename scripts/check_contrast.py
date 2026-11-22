#!/usr/bin/env python3
"""Checks essential color pairs in tokens against WCAG thresholds.

Only checks declared pairs; passing does NOT certify a whole application.
"""
from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parents[1]
COLORS = json.loads((ROOT / "tokens/tokens.json").read_text(encoding="utf-8"))["color"]
PAIRS = [
    ("forest", "white", 4.5, "botón principal"),
    ("forest", "paper", 4.5, "texto sobre papel"),
    ("graphite", "paper", 4.5, "texto principal"),
    ("muted", "paper", 4.5, "texto secundario"),
    ("success", "white", 4.5, "texto de estado éxito"),
    ("warning", "white", 4.5, "texto de estado advertencia"),
    ("danger", "white", 4.5, "texto de estado peligro"),
    ("info", "white", 4.5, "texto de estado información"),
    ("field-border", "white", 3.0, "borde de input"),
    ("info", "paper", 3.0, "anillo de foco")
]

def luminance(hexc):
    hexc = hexc.lstrip("#")
    if len(hexc) != 6:
        raise ValueError(f"Expected #RRGGBB, got: {hexc}")
    vals = [int(hexc[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    vals = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in vals]
    return .2126 * vals[0] + .7152 * vals[1] + .0722 * vals[2]

def contrast(a, b):
    low, high = sorted([luminance(a), luminance(b)])
    return (high + .05) / (low + .05)

failed = False
for left, right, target, purpose in PAIRS:
    ratio = contrast(COLORS[left], COLORS[right])
    passed = ratio >= target
    print(f"{'PASS' if passed else 'FAIL'}  {ratio:.2f}:1  {left} / {right}  ({purpose}, mínimo {target}:1)")
    failed |= not passed
print("\nNOTA: Ocre y terracota son acentos decorativos; validar cada combinación antes de usarlos como texto.")
print("La accesibilidad completa también requiere UI real, estados, teclado, tamaños y lector de pantalla.")
sys.exit(1 if failed else 0)
