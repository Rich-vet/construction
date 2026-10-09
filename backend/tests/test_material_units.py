"""Material quantity units are implied by the material, not chosen on a request."""

from app.utils.material_units import resolve_unit, standard_unit


def test_known_materials_use_a_fixed_unit():
    assert standard_unit("Sand") == "tons"
    assert resolve_unit("River Sand", "m3") == "tons"
    assert resolve_unit("Concrete Blocks", "pieces") == "inches"
    assert resolve_unit("Cement", None) == "bags"
    assert resolve_unit("Steel Bars", "lengths") == "tons"


def test_unknown_material_keeps_its_stored_unit():
    assert resolve_unit("Curing Compound", "drums") == "drums"
    assert resolve_unit("Custom Item", None) == "units"
