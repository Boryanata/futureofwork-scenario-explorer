#!/usr/bin/env python3
"""Extract text from project PDFs into data/interim/pdf_text."""

from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRS = [
    ROOT / "docs" / "sources",
    ROOT / "data" / "raw" / "policy",
    ROOT / "data" / "raw" / "oecd" / "ictwss",
]
OUTPUT_DIR = ROOT / "data" / "interim" / "pdf_text"


def output_path_for(pdf_path: Path) -> Path:
    relative = pdf_path.relative_to(ROOT)
    safe_name = "__".join(relative.with_suffix("").parts) + ".txt"
    return OUTPUT_DIR / safe_name


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = []
    for directory in SOURCE_DIRS:
        if directory.exists():
            pdfs.extend(sorted(directory.rglob("*.pdf")))

    failures = []
    for pdf in pdfs:
        out = output_path_for(pdf)
        result = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", str(pdf), str(out)],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            failures.append((pdf, result.stderr.strip()))

    print(f"Extracted {len(pdfs) - len(failures)} of {len(pdfs)} PDFs into {OUTPUT_DIR.relative_to(ROOT)}")
    if failures:
        print("Failures:")
        for pdf, error in failures:
            print(f"- {pdf.relative_to(ROOT)}: {error}")


if __name__ == "__main__":
    main()
