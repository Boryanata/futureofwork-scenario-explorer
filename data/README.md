# Data Directory

This folder separates original downloads from cleaned and app-ready data.

## `raw/`

Original downloaded data. Do not edit these files manually.

## `interim/`

Cleaned data that may still be too large, too detailed, or too source-specific for the app.

## `processed/`

Final app-ready files, such as curated occupation profiles, scenario dimensions, evidence matrix exports, and scenario rules.

The expected pipeline is:

```text
raw datasets + literature
  -> interim cleaned files
  -> processed explorer files
  -> interactive scenario explorer
```
