#!/usr/bin/env python3
"""Build app-ready scenario rules JSON from the editable CSV."""

from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RULES_CSV = ROOT / "data" / "processed" / "scenario_rules.csv"
RULES_JSON = ROOT / "data" / "processed" / "scenario_rules.json"


def parse_value(raw: str):
    if raw == "true":
        return True
    if raw == "false":
        return False
    if "_or_" in raw:
        return raw.split("_or_")
    return raw


def parse_condition(expr: str) -> dict:
    expr = expr.strip()

    if expr == "occupation has low/medium/high AI exposure":
        return {
            "operator": "any",
            "clauses": [
                {"all": [{"field": "ai_exposure", "operator": "equals", "value": "low"}]},
                {"all": [{"field": "ai_exposure", "operator": "equals", "value": "medium"}]},
                {"all": [{"field": "ai_exposure", "operator": "equals", "value": "high"}]},
            ],
        }

    group_operator = "any" if " OR " in expr else "all"
    group_separator = " OR " if group_operator == "any" else " AND "
    groups = expr.split(group_separator)
    clauses = []

    for group in groups:
        conditions = []
        for part in group.split(" AND "):
            if "=" not in part:
                raise ValueError(f"Cannot parse condition fragment: {part!r}")
            field, raw_value = part.split("=", 1)
            value = parse_value(raw_value.strip())
            operator = "in" if isinstance(value, list) else "equals"
            conditions.append(
                {
                    "field": field.strip(),
                    "operator": operator,
                    "value": value,
                }
            )
        clauses.append({"all": conditions})

    return {"operator": group_operator, "clauses": clauses}


def split_semicolon(value: str) -> list[str]:
    return [item.strip() for item in value.split(";") if item.strip()]


def build_rule(row: dict) -> dict:
    return {
        "id": row["rule_id"],
        "name": row["rule_name"],
        "conditions": parse_condition(row["applies_when"]),
        "geography": row["geography"],
        "outcome": {
            "primary": row["primary_outcome"],
            "secondary": split_semicolon(row["secondary_outcomes"]),
            "tendency": row["outcome_tendency"],
            "confidence": row["confidence"],
        },
        "work_design_pattern": row["work_design_pattern"],
        "narrative_template": row["narrative_template"],
        "evidence_ids": split_semicolon(row["evidence_ids"]),
        "notes": row["notes"],
    }


def main() -> None:
    with RULES_CSV.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    payload = {
        "source": str(RULES_CSV.relative_to(ROOT)),
        "description": "App-ready scenario rules generated from the editable CSV.",
        "rules": [build_rule(row) for row in rows],
    }

    RULES_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} rules to {RULES_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
