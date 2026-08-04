#!/usr/bin/env python3
"""Build a review queue of possible evidence-matrix rows.

This script does not replace human coding. It scans source documents for
sentences that look relevant to the scenario framework, suggests rough tags,
and writes a CSV that can be reviewed before adding rows to the final evidence
matrix.
"""

from __future__ import annotations

import csv
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRS = [
    ROOT / "docs" / "sources",
    ROOT / "data" / "raw" / "policy",
    ROOT / "data" / "raw" / "literature",
    ROOT / "data" / "interim" / "pdf_text",
]
OUTPUT = ROOT / "data" / "interim" / "evidence_candidates.csv"

TEXT_EXTENSIONS = {".txt", ".md", ".html", ".htm"}
SUPPORTED_EXTENSIONS = TEXT_EXTENSIONS | {".pdf"}

KEYWORDS = {
    "ai_governance": ["ai governance", "regulation", "regulatory", "risk assessment", "human oversight", "transparency"],
    "workforce_development": ["workforce development", "skillsfuture", "reskilling", "upskilling", "training", "career conversion"],
    "collective_bargaining": ["collective bargaining", "union", "unions", "tripartite", "social dialogue", "worker voice"],
    "social_protection": ["social protection", "unemployment", "wage insurance", "transition support", "income support"],
    "employment_protection": ["employment protection", "dismissal", "layoff", "redundancy", "job security"],
    "employer_retraining": ["employer retraining", "retraining obligation", "training grant", "job redesign", "workforce transformation"],
}

MECHANISMS = {
    "automation_first": ["automate", "automation", "replace", "substitution", "eliminate"],
    "augmentation": ["augment", "augmentation", "assist", "human oversight", "human review", "complement"],
    "retraining": ["retrain", "reskill", "upskill", "training", "career conversion"],
    "worker_participation": ["worker participation", "consultation", "social dialogue", "tripartite", "collective bargaining"],
    "job_redesign": ["job redesign", "redesigned jobs", "task allocation", "work redesign", "workforce transformation"],
    "skill_investment": ["skill investment", "human capital", "learning", "skills development"],
}

OUTCOMES = {
    "employment": ["employment", "jobs", "job creation", "job loss", "layoffs"],
    "wages": ["wage", "wages", "earnings", "pay"],
    "mobility": ["mobility", "career mobility", "move into", "transition into"],
    "productivity": ["productivity", "efficiency", "output"],
    "redeployment": ["redeployment", "redeploy", "transition support", "career conversion"],
    "displacement": ["displacement", "displaced", "replace workers", "job loss", "layoffs"],
    "skill_accumulation": ["skill", "skills", "learning", "human capital", "capabilities"],
    "distribution_of_gains": ["shared gains", "benefits", "inequality", "distribution", "who benefits"],
}

GEOGRAPHIES = {
    "singapore": ["singapore", "skillsfuture", "workforce singapore", "mom", "tripartite"],
    "denmark": ["denmark", "danish", "nordic", "flexicurity"],
    "united_states": ["united states", "u.s.", "us ", "america", "american"],
    "nyc": ["new york city", "nyc"],
    "oecd": ["oecd"],
}


def read_text(path: Path) -> tuple[str, str]:
    suffix = path.suffix.lower()
    if suffix in TEXT_EXTENSIONS:
        return path.read_text(encoding="utf-8", errors="replace"), "text"
    if suffix == ".pdf":
        text = read_pdf_spotlight_text(path)
        if text:
            return text, "pdf_spotlight"
        return "", "pdf_needs_manual_review"
    return "", "unsupported"


def read_pdf_spotlight_text(path: Path) -> str:
    try:
        result = subprocess.run(
            ["mdls", "-raw", "-name", "kMDItemTextContent", str(path)],
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (OSError, subprocess.SubprocessError):
        return ""

    text = result.stdout.strip()
    if not text or text == "(null)" or "could not find" in text.lower():
        return ""
    return text


def normalize(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_sentences(text: str) -> list[str]:
    text = normalize(text)
    if not text:
        return []
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 80]


def match_tags(sentence: str, dictionary: dict[str, list[str]]) -> list[str]:
    lower = sentence.lower()
    matches = []
    for tag, words in dictionary.items():
        if any(word in lower for word in words):
            matches.append(tag)
    return matches


def direction_hint(sentence: str) -> str:
    lower = sentence.lower()
    positive = ["support", "improve", "increase", "strengthen", "enable", "benefit", "protect", "enhance"]
    negative = ["risk", "worsen", "reduce", "displace", "replace", "layoff", "inequality", "suppress"]
    has_positive = any(word in lower for word in positive)
    has_negative = any(word in lower for word in negative)
    if has_positive and has_negative:
        return "mixed"
    if has_positive:
        return "improves"
    if has_negative:
        return "increases_risk"
    return "contextual"


def source_type(path: Path) -> str:
    lower = str(path).lower()
    if "/pdf_text/" in lower:
        return "extracted pdf text"
    if "/policy/" in lower:
        return "government/policy document"
    if path.suffix.lower() == ".pdf":
        return "pdf source"
    if path.suffix.lower() in {".html", ".htm"}:
        return "webpage"
    return "source note"


def build_rows() -> list[dict[str, str]]:
    rows = []
    counter = 1
    files = []
    for directory in SOURCE_DIRS:
        if directory.exists():
            files.extend(
                p
                for p in directory.rglob("*")
                if p.is_file()
                and p.suffix.lower() in SUPPORTED_EXTENSIONS
                and p.name.lower() != "readme.md"
            )

    for path in sorted(files):
        text, extraction_method = read_text(path)
        if not text:
            rows.append(
                {
                    "candidate_id": f"cand_{counter:04d}",
                    "source_file": str(path.relative_to(ROOT)),
                    "source_type": source_type(path),
                    "extraction_method": extraction_method,
                    "institutional_dimension": "",
                    "organizational_mechanism": "",
                    "outcome_dimension": "",
                    "geography": "",
                    "direction_hint": "",
                    "candidate_text": "",
                    "review_status": "needs_manual_extraction",
                    "notes": "Could not extract text automatically.",
                }
            )
            counter += 1
            continue

        for sentence in split_sentences(text):
            inst = match_tags(sentence, KEYWORDS)
            mech = match_tags(sentence, MECHANISMS)
            out = match_tags(sentence, OUTCOMES)
            geo = match_tags(sentence, GEOGRAPHIES)
            if not (inst or mech or out):
                continue
            rows.append(
                {
                    "candidate_id": f"cand_{counter:04d}",
                    "source_file": str(path.relative_to(ROOT)),
                    "source_type": source_type(path),
                    "extraction_method": extraction_method,
                    "institutional_dimension": ";".join(inst),
                    "organizational_mechanism": ";".join(mech),
                    "outcome_dimension": ";".join(out),
                    "geography": ";".join(geo),
                    "direction_hint": direction_hint(sentence),
                    "candidate_text": sentence[:1200],
                    "review_status": "needs_review",
                    "notes": "",
                }
            )
            counter += 1

    return rows


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    rows = build_rows()
    fieldnames = [
        "candidate_id",
        "source_file",
        "source_type",
        "extraction_method",
        "institutional_dimension",
        "organizational_mechanism",
        "outcome_dimension",
        "geography",
        "direction_hint",
        "candidate_text",
        "review_status",
        "notes",
    ]
    with OUTPUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} evidence candidates to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
