# Data Directory

This folder separates original downloads from cleaned and app-ready data.

## `raw/`

Original downloaded data. Do not edit these files manually.

## `interim/`

Cleaned data that may still be too large, too detailed, or too source-specific for the app.

## `processed/`

Final app-ready files, such as curated occupation profiles, scenario dimensions, evidence matrix exports, and scenario rules.

Current generated files:

```text
app_data_manifest.json
evidence_references.json
exposure_baselines.json
geography_presets.json
occupations.json
scenario_rules.csv
scenario_rules.json
```

`scenario_rules.csv` remains the editable design file. `scenario_rules.json` is generated for the app.

The expected pipeline is:

```text
raw datasets + literature
  -> interim cleaned files
  -> processed explorer files
  -> interactive scenario explorer
```

Regenerate processed files with:

```text
python3 scripts/build_scenario_rules_json.py
python3 scripts/build_app_data.py
```
