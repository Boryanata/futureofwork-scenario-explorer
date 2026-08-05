# Scripts

This folder contains data cleaning and transformation scripts.

Current scripts:

```text
extract_pdf_text.py              # PDF source files -> searchable text files
build_evidence_candidates.py     # source documents -> review queue for evidence matrix
filter_evidence_candidates.py    # full review queue -> high-priority review queue
build_scenario_rules_json.py     # scenario_rules.csv -> app-ready scenario_rules.json
build_app_data.py                # raw datasets + evidence matrix -> app-ready JSON files
demo_scenario_engine.mjs         # dependency-free scenario-engine demo
```

Regenerate the app-ready data layer with:

```text
python3 scripts/build_scenario_rules_json.py
python3 scripts/build_app_data.py
```

Run the scenario-engine demo with:

```text
node scripts/demo_scenario_engine.mjs
```
