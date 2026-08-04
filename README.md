# Institutional Scenario Explorer for AI and Labor Futures

This repository contains the data, scenario logic, and interactive web app for an evidence-informed scenario explorer. The project holds occupational AI exposure as a baseline condition and compares how institutional arrangements and organizational strategies shape divergent labor futures.

## Current Folder Map

```text
data/
  raw/
    onet/        # Original O*NET downloads
    bls/         # Original BLS/OEWS downloads
    oecd/        # Original OECD downloads
    anthropic/   # Anthropic Economic Index or related downloads
    literature/  # Manually coded research/evidence files
  interim/       # Cleaned but not final transformed data
  processed/     # App-ready JSON/CSV files
docs/            # Method notes, data sources, evidence codebook
scripts/         # Data cleaning and transformation scripts
src/             # Future web app source code
```

## First Data Step

Place the O*NET CSV files in:

```text
data/raw/onet/
```

Keep the original file names if possible. The transformation scripts will use `O*NET-SOC Code` as the join key across files.
