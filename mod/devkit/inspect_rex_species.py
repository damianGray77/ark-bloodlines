import unreal


def report(label, value):
    unreal.log_warning(f"ABL_INSPECT {label}: type={type(value).__name__} value={value!r}")


rex_blueprint = unreal.load_asset("/Game/PrimalEarth/Dinos/Rex/Rex_Character_BP")
report("asset", rex_blueprint)

rex_class = rex_blueprint.generated_class()
report("class", rex_class)

rex_default = unreal.get_default_object(rex_class)
report("default_object", rex_default)

candidate_properties = [
    "DinoNameTag",
    "dino_name_tag",
    "DescriptiveName",
    "descriptive_name",
    "DescriptiveNameBase",
    "descriptive_name_base",
    "DinoDescriptiveName",
    "dino_descriptive_name",
]

for candidate in candidate_properties:
    try:
        report(candidate, rex_default.get_editor_property(candidate))
    except Exception as error:
        unreal.log_warning(f"ABL_INSPECT {candidate}: ERROR {error}")

matching_names = [
    name
    for name in dir(rex_default)
    if ("dino" in name.lower() or "descriptive" in name.lower())
    and "name" in name.lower()
]
report("matching_python_names", matching_names)
