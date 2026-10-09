"""Quantity units implied by a material name.

The requester does not choose a unit. Known construction materials resolve to
a fixed unit; anything else keeps the unit stored on the catalog row.
"""

from __future__ import annotations

# Longer or more specific names are listed before broader ones.
_RULES: tuple[tuple[str, str], ...] = (
    ("sand", "tons"),
    ("block", "inches"),
    ("brick", "pieces"),
    ("cement", "bags"),
    ("steel", "tons"),
    ("rebar", "tons"),
    ("gravel", "tons"),
    ("aggregate", "tons"),
    ("ballast", "tons"),
    ("stone", "tons"),
    ("timber", "metres"),
    ("plank", "metres"),
    ("paint", "litres"),
    ("nail", "kilograms"),
    ("screw", "kilograms"),
    ("pipe", "metres"),
    ("cable", "metres"),
    ("wire", "metres"),
    ("tile", "square metres"),
    ("glass", "square metres"),
    ("roof", "square metres"),
    ("concrete", "cubic metres"),
    ("water", "litres"),
    ("diesel", "litres"),
    ("fuel", "litres"),
)


def standard_unit(name: str | None) -> str | None:
    """Return the catalog unit for a known material name."""
    key = (name or "").strip().lower()
    if not key:
        return None
    for needle, unit in _RULES:
        if needle in key:
            return unit
    return None


def resolve_unit(name: str | None, stored: str | None = None) -> str:
    """Prefer the standard unit, then the stored catalog unit."""
    return standard_unit(name) or (stored or "").strip() or "units"
