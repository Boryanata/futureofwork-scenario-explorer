#!/usr/bin/env python3
"""Create a smaller high-priority evidence candidate review file."""

from __future__ import annotations

import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "interim" / "evidence_candidates.csv"
OUTPUT = ROOT / "data" / "interim" / "evidence_candidates_priority.csv"

PRIORITY_TERMS = [
    "ai",
    "artificial intelligence",
    "algorithmic",
    "automation",
    "collective bargaining",
    "social dialogue",
    "worker participation",
    "tripartite",
    "skillsfuture",
    "flexicurity",
    "workforce development",
    "retraining",
    "reskilling",
    "job redesign",
    "task allocation",
    "human-ai",
    "human ai",
]

PRIORITY_SOURCES = [
    "The OECD Exposure Measure",
    "Human-AI Collaborative",
    "Effective human",
    "Algorithms as work designers",
    "AI Work Redesign",
    "Global case studies of social dialogue",
    "Algorithmic management and collective bargaining",
    "Human-centered AI",
    "Formation of Tripartite Jobs Council",
    "SkillsFuture",
    "Response to Motion on AI",
    "kreiner-svarer",
    "IMF Country Reports_Denmark",
    "Work to Do",
    "How Retrainable",
    "Workforce Development Policy",
]


def score(row: dict[str, str]) -> int:
    text = " ".join(
        [
            row.get("source_file", ""),
            row.get("institutional_dimension", ""),
            row.get("organizational_mechanism", ""),
            row.get("outcome_dimension", ""),
            row.get("geography", ""),
            row.get("candidate_text", ""),
        ]
    ).lower()
    source_file = row.get("source_file", "")
    value = 0
    value += sum(2 for term in PRIORITY_TERMS if term in text)
    value += sum(5 for term in PRIORITY_SOURCES if term.lower() in source_file.lower())
    if row.get("institutional_dimension") and row.get("outcome_dimension"):
        value += 4
    if row.get("organizational_mechanism") and row.get("outcome_dimension"):
        value += 3
    if row.get("geography") in {"singapore", "denmark", "nyc", "united_states"}:
        value += 2
    return value


def main() -> None:
    with INPUT.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        fieldnames = list(rows[0].keys()) + ["priority_score"]

    scored = []
    seen_text = set()
    for row in rows:
        candidate_text = row.get("candidate_text", "").strip()
        if not candidate_text:
            continue
        dedupe_key = candidate_text[:280].lower()
        if dedupe_key in seen_text:
            continue
        seen_text.add(dedupe_key)
        row["priority_score"] = str(score(row))
        scored.append(row)

    scored.sort(key=lambda row: int(row["priority_score"]), reverse=True)
    selected = [row for row in scored if int(row["priority_score"]) >= 12][:350]

    with OUTPUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(selected)

    print(f"Wrote {len(selected)} priority candidates to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
