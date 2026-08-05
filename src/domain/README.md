# Scenario Domain Engine

This folder contains the rule-based scenario logic for the explorer.

The engine is intentionally not predictive. It evaluates evidence-backed rules and returns directional scenario tendencies.

## Files

```text
types.ts             # Shared domain types
scenarioEngine.ts    # Rule matching and outcome grouping
scoring.ts           # Tendency/confidence scoring helpers
explanations.ts      # Human-readable labels and summaries
```

## Data Flow

```text
scenario_rules.csv
  -> scenario_rules.json
  -> evaluateScenario(context, rules)
  -> matched rules + outcome cards + evidence IDs
```

## Demo

Run a dependency-free demo with:

```text
node scripts/demo_scenario_engine.mjs
```

The demo compares three scenarios:

- automation-first with weak support
- worker-centered augmentation
- NYC hiring-screening AI with bias-audit safeguards

## Important Framing

The engine does not estimate job loss, wages, or productivity. It shows how different institutional and organizational choices are associated with different directional outcome tendencies under a held-constant AI exposure baseline.
