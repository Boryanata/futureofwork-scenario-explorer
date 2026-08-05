# Scenario Rules Codebook

The scenario rules file translates the evidence matrix into app-facing logic.

Working file:

```text
data/processed/scenario_rules.csv
```

App-ready generated file:

```text
data/processed/scenario_rules.json
```

## Purpose

The evidence matrix stores source-backed claims. The scenario rules file turns those claims into conditional statements the explorer can use.

The CSV remains the human-readable design file. The JSON is generated from the CSV and should be used by the application.

The rules are not statistical predictions. They produce directional scenario tendencies such as:

- higher redeployment capacity
- increased displacement risk
- improved job quality
- mixed or contextual wage effects

## Policy Tools

Policy tools are institutional levers that shape how AI exposure becomes workplace change. They can appear as user controls, geography presets, or background case conditions.

Current policy-tool categories include:

- AI governance and rights-based regulation
- human oversight requirements
- algorithmic transparency and worker information rights
- data protection and anti-discrimination safeguards
- worker consultation and collective bargaining rights
- public workforce-development investment
- employer retraining and job-redesign incentives
- social protection and transition support
- employment protection and minimum labor standards

These policy tools should not be treated as automatic guarantees. They change the scenario tendency by affecting organizational incentives, worker voice, retraining capacity, and the distribution of gains from AI adoption.

## Columns

```text
rule_id
rule_name
applies_when
geography
primary_outcome
secondary_outcomes
outcome_tendency
confidence
work_design_pattern
narrative_template
evidence_ids
notes
```

## Definitions

`rule_id`
Stable machine-readable identifier.

`rule_name`
Short human-readable label.

`applies_when`
Plain-language condition for when the rule should fire. This will later become structured app logic.

`geography`
`general`, `singapore`, `denmark`, `nyc`, etc.

`primary_outcome`
The main outcome affected by the rule. Use one primary outcome only.

`secondary_outcomes`
Optional additional outcomes affected by the rule.

`outcome_tendency`
Directional scenario tendency: `improves`, `mixed`, `contextual`, `increases_risk`, or `decreases_risk`.

`confidence`
Evidence confidence: `limited`, `moderate`, or `stronger`.

`work_design_pattern`
Derived human-AI work design pattern produced by institutional and organizational conditions.

`narrative_template`
Short explanation that can appear in the scenario output or evidence panel.

`evidence_ids`
Semicolon-separated `source_id` values from `data/raw/literature/evidence_matrix.csv`.

`notes`
Caveats or implementation notes.

## Design Rule

Each rule should point back to at least one excerpt-verified evidence row unless it is explicitly marked as a framing rule. For the MVP, favor a smaller number of transparent rules over a large rule set that is hard to explain.

## Regenerating JSON

After editing `data/processed/scenario_rules.csv`, regenerate the app-ready JSON with:

```text
python3 scripts/build_scenario_rules_json.py
```

The script converts `applies_when` into structured `conditions`:

- `AND` becomes an `all` condition group.
- `OR` becomes an `any` condition group.
- values like `moderate_or_strong` become list checks.
- `true` and `false` become boolean values.
