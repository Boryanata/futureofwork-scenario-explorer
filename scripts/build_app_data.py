#!/usr/bin/env python3
"""Build compact app-ready JSON files from raw datasets and coded evidence."""

from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"

XML_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
XML_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PACKAGE_REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def to_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = str(value).strip().replace(",", "")
    if not value or value in {"*", "#", "**"}:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def soc6(onet_soc: str) -> str:
    return onet_soc.split(".")[0]


def col_to_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    idx = 0
    for ch in letters:
        idx = idx * 26 + ord(ch.upper()) - 64
    return idx - 1


def shared_strings(zf: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    values = []
    for si in root.findall(f"{XML_MAIN}si"):
        texts = [node.text or "" for node in si.iter(f"{XML_MAIN}t")]
        values.append("".join(texts))
    return values


def sheet_paths(zf: ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rid_to_target = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall(f"{PACKAGE_REL}Relationship")
    }
    paths = {}
    for sheet in workbook.find(f"{XML_MAIN}sheets"):
        name = sheet.attrib["name"]
        rid = sheet.attrib[f"{XML_REL}id"]
        target = rid_to_target[rid]
        if not target.startswith("xl/"):
            target = "xl/" + target
        paths[name] = target
    return paths


def read_xlsx_sheet(path: Path, sheet_name: str) -> list[list[str]]:
    with ZipFile(path) as zf:
        strings = shared_strings(zf)
        paths = sheet_paths(zf)
        root = ET.fromstring(zf.read(paths[sheet_name]))
        rows = []
        for row in root.findall(f".//{XML_MAIN}sheetData/{XML_MAIN}row"):
            values: list[str] = []
            for cell in row.findall(f"{XML_MAIN}c"):
                idx = col_to_index(cell.attrib.get("r", "A1"))
                while len(values) <= idx:
                    values.append("")
                cell_type = cell.attrib.get("t")
                v = cell.find(f"{XML_MAIN}v")
                if v is None:
                    value = ""
                elif cell_type == "s":
                    value = strings[int(v.text or "0")]
                else:
                    value = v.text or ""
                values[idx] = value
            rows.append(values)
        return rows


def rows_from_xlsx(path: Path, sheet_name: str, header_row: int = 0) -> list[dict]:
    rows = read_xlsx_sheet(path, sheet_name)
    header = [str(v).strip() for v in rows[header_row]]
    records = []
    for row in rows[header_row + 1 :]:
        if not any(str(v).strip() for v in row):
            continue
        padded = row + [""] * (len(header) - len(row))
        records.append({header[i]: str(padded[i]).strip() for i in range(len(header))})
    return records


def top_by_importance(rows: list[dict], code_field: str, limit: int, extra_type: str | None = None) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        if row.get("Scale ID") != "IM":
            continue
        value = to_float(row.get("Data Value"))
        if value is None:
            continue
        item = {
            "id": row.get("Element ID", ""),
            "name": row.get("Element Name", ""),
            "importance": value,
        }
        if extra_type:
            item["type"] = extra_type
        grouped[row[code_field]].append(item)
    for code, items in grouped.items():
        grouped[code] = sorted(items, key=lambda item: item["importance"], reverse=True)[:limit]
    return grouped


def build_task_ratings() -> dict[tuple[str, str], dict]:
    ratings = {}
    for row in read_csv(RAW / "onet" / "task_ratings.csv"):
        key = (row["O*NET-SOC Code"], row["Task ID"])
        ratings.setdefault(key, {})
        if row["Scale ID"] == "IM":
            ratings[key]["importance"] = to_float(row.get("Data Value"))
        elif row["Scale ID"] == "FT":
            ratings[key]["frequency"] = to_float(row.get("Data Value"))
            ratings[key]["frequency_category"] = row.get("Category", "")
        elif row["Scale ID"] == "RT":
            ratings[key]["relevance"] = to_float(row.get("Data Value"))
    return ratings


def build_tasks(limit: int = 8) -> dict[str, list[dict]]:
    ratings = build_task_ratings()
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in read_csv(RAW / "onet" / "task_statements.csv"):
        code = row["O*NET-SOC Code"]
        task = {
            "id": row["Task ID"],
            "text": row["Task"],
            "type": row.get("Task Type", ""),
            **ratings.get((code, row["Task ID"]), {}),
        }
        grouped[code].append(task)
    for code, tasks in grouped.items():
        grouped[code] = sorted(
            tasks,
            key=lambda item: (
                item.get("type") == "Core",
                item.get("importance") if item.get("importance") is not None else -1,
                item.get("frequency") if item.get("frequency") is not None else -1,
            ),
            reverse=True,
        )[:limit]
    return grouped


def build_job_zones() -> dict[str, dict]:
    references = {row["Job Zone"]: row for row in read_csv(RAW / "onet" / "job_zone_reference.csv")}
    zones = {}
    for row in read_csv(RAW / "onet" / "job_zones.csv"):
        ref = references.get(row["Job Zone"], {})
        zones[row["O*NET-SOC Code"]] = {
            "zone": row["Job Zone"],
            "name": ref.get("Name", ""),
            "experience": ref.get("Experience", ""),
            "education": ref.get("Education", ""),
            "job_training": ref.get("Job Training", ""),
            "svp_range": ref.get("SVP Range", ""),
        }
    return zones


def build_bls_national() -> dict[str, dict]:
    path = RAW / "bls" / "oesm25nat" / "national_M2025_dl.xlsx"
    rows = rows_from_xlsx(path, "national_M2025_dl")
    output = {}
    for row in rows:
        if row.get("O_GROUP") != "detailed":
            continue
        code = row["OCC_CODE"]
        output[code] = {
            "employment": to_float(row.get("TOT_EMP")),
            "hourly_mean_wage": to_float(row.get("H_MEAN")),
            "annual_mean_wage": to_float(row.get("A_MEAN")),
            "source": "BLS OEWS May 2025 national estimates",
        }
    return output


def exposure_level(score: float | None) -> str | None:
    if score is None:
        return None
    if score >= 0.66:
        return "high"
    if score >= 0.33:
        return "medium"
    return "low"


def build_aioe() -> dict[str, dict]:
    path = RAW / "aioe" / "AIOE-main" / "AIOE_DataAppendix.xlsx"
    rows = rows_from_xlsx(path, "Appendix A")
    values = [to_float(row.get("AIOE")) for row in rows]
    values = sorted(v for v in values if v is not None)
    output = {}
    for row in rows:
        score = to_float(row.get("AIOE"))
        if score is None:
            continue
        below = sum(1 for v in values if v <= score)
        percentile = below / len(values) if values else None
        output[row["SOC Code"]] = {
            "score": score,
            "percentile": round(percentile, 4) if percentile is not None else None,
            "level": exposure_level(percentile),
            "source": "Felten, Raj, and Seamans AIOE",
        }
    return output


def build_oecd_exposure() -> dict[str, dict]:
    path = RAW / "oecd" / "ai_exposure" / "OECD AI Capability Gap Index_public data.xlsx"
    rows = rows_from_xlsx(path, "Data", header_row=2)
    output = {}
    for row in rows:
        code = row.get("OCC_Code", "")
        if not re.match(r"^\d{2}-\d{4}\.\d{2}$", code):
            continue
        score = to_float(row.get("AI Capability Gap Index_Rev. norm."))
        total_gap = to_float(row.get("AI Capability Gap Index_Total"))
        output[code] = {
            "score": score,
            "total_gap": total_gap,
            "level": exposure_level(score),
            "source": "OECD AI Capability Gap Index reversed normalized score",
        }
    return output


def combined_exposure(onet_code: str, aioe: dict, oecd: dict) -> dict:
    aioe_item = aioe.get(soc6(onet_code))
    oecd_item = oecd.get(onet_code)
    scores = []
    if aioe_item and aioe_item["percentile"] is not None:
        scores.append(aioe_item["percentile"])
    if oecd_item and oecd_item["score"] is not None:
        scores.append(oecd_item["score"])
    combined = sum(scores) / len(scores) if scores else None
    return {
        "combined_score": round(combined, 4) if combined is not None else None,
        "combined_level": exposure_level(combined),
        "aioe": aioe_item,
        "oecd": oecd_item,
    }


def build_occupations() -> list[dict]:
    tasks = build_tasks()
    essential = top_by_importance(read_csv(RAW / "onet" / "essential_skills.csv"), "O*NET-SOC Code", 6, "essential")
    transferable = top_by_importance(read_csv(RAW / "onet" / "transferable_skills.csv"), "O*NET-SOC Code", 6, "transferable")
    activities = top_by_importance(read_csv(RAW / "onet" / "work_activities.csv"), "O*NET-SOC Code", 8)
    job_zones = build_job_zones()
    bls = build_bls_national()
    aioe = build_aioe()
    oecd = build_oecd_exposure()

    occupations = []
    for row in read_csv(RAW / "onet" / "occupation_data.csv"):
        code = row["O*NET-SOC Code"]
        six = soc6(code)
        occupation = {
            "onet_soc_code": code,
            "soc_code": six,
            "title": row["Title"],
            "description": row["Description"],
            "job_zone": job_zones.get(code),
            "tasks": tasks.get(code, []),
            "skills": {
                "essential": essential.get(code, []),
                "transferable": transferable.get(code, []),
            },
            "work_activities": activities.get(code, []),
            "employment_wages": bls.get(six),
            "exposure_baseline": combined_exposure(code, aioe, oecd),
        }
        occupations.append(occupation)

    return sorted(occupations, key=lambda item: (item["title"], item["onet_soc_code"]))


def build_exposure_baselines(occupations: list[dict]) -> list[dict]:
    return [
        {
            "onet_soc_code": occ["onet_soc_code"],
            "soc_code": occ["soc_code"],
            "title": occ["title"],
            **occ["exposure_baseline"],
        }
        for occ in occupations
    ]


def build_evidence_references() -> list[dict]:
    rows = read_csv(RAW / "literature" / "evidence_matrix.csv")
    return [
        {
            "source_id": row["source_id"],
            "citation": row["citation"],
            "source_type": row["source_type"],
            "source_file": row["source_file"],
            "page_ref": row["page_ref"],
            "claim_summary": row["claim_summary"],
            "evidence_excerpt": row["evidence_excerpt"],
            "confidence": row["confidence"],
            "verification_status": row["verification_status"],
        }
        for row in rows
    ]


def build_geography_presets() -> list[dict]:
    return [
        {
            "id": "united_states",
            "name": "United States",
            "description": "Fragmented workforce-development and social-protection context with policy variation across states and cities.",
            "institutional_arrangement": {
                "ai_governance": "moderate",
                "workforce_development": "moderate",
                "employer_retraining_incentives": "low",
                "collective_bargaining": "weak",
                "social_protection": "minimal",
                "employment_protection": "weak",
                "algorithmic_transparency": "limited",
                "worker_information_rights": "limited",
            },
            "evidence_ids": [
                "brookings_workforce_development_us",
                "ny_fed_retrainable_ai_workers",
                "felten_raj_seamans_2021",
            ],
        },
        {
            "id": "nyc",
            "name": "New York City",
            "description": "U.S. local case with workforce pathways and specific safeguards for automated employment decision tools.",
            "institutional_arrangement": {
                "ai_governance": "moderate",
                "workforce_development": "moderate",
                "employer_retraining_incentives": "low",
                "collective_bargaining": "weak",
                "social_protection": "minimal",
                "employment_protection": "weak",
                "algorithmic_transparency": "strong",
                "worker_information_rights": "moderate",
                "bias_audit_requirements": "strong",
            },
            "evidence_ids": [
                "nyc_career_pathways",
                "cuf_automation_nyc",
                "nyc_aedt_bias_audit_2021",
            ],
        },
        {
            "id": "singapore",
            "name": "Singapore",
            "description": "Tripartite workforce-transformation model with public training infrastructure and employer-facing redesign incentives.",
            "institutional_arrangement": {
                "ai_governance": "moderate",
                "workforce_development": "strong",
                "employer_retraining_incentives": "high",
                "collective_bargaining": "moderate",
                "social_protection": "moderate",
                "employment_protection": "moderate",
                "algorithmic_transparency": "limited",
                "worker_information_rights": "moderate",
            },
            "evidence_ids": [
                "singapore_tjc_coordinated_ai_transition_2026",
                "singapore_tjc_job_redesign_reskilling_2026",
                "singapore_wdg_wage_retention_2026",
                "singapore_skillsfuture_ai_readiness_2026",
                "singapore_skillsfuture_wsg_reskilling_2025",
            ],
        },
        {
            "id": "denmark",
            "name": "Denmark",
            "description": "Flexicurity and collective-bargaining case with strong income security, active labor-market policy, and social-dialogue institutions.",
            "institutional_arrangement": {
                "ai_governance": "moderate",
                "workforce_development": "strong",
                "employer_retraining_incentives": "moderate",
                "collective_bargaining": "strong",
                "social_protection": "strong",
                "employment_protection": "moderate",
                "algorithmic_transparency": "moderate",
                "worker_information_rights": "strong",
            },
            "evidence_ids": [
                "kreiner_svarer_2022_flexicurity",
                "denmark_collective_bargaining_labor_conditions_2022",
                "denmark_unemployment_benefit_security_2022",
                "imf_denmark_ai_labor_2025",
                "denmark_ai_collective_bargaining_sdu_2026",
            ],
        },
    ]


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    occupations = build_occupations()
    write_json(PROCESSED / "occupations.json", occupations)
    write_json(PROCESSED / "exposure_baselines.json", build_exposure_baselines(occupations))
    write_json(PROCESSED / "geography_presets.json", build_geography_presets())
    write_json(PROCESSED / "evidence_references.json", build_evidence_references())

    with (PROCESSED / "app_data_manifest.json").open("w", encoding="utf-8") as f:
        json.dump(
            {
                "outputs": {
                    "occupations": "data/processed/occupations.json",
                    "exposure_baselines": "data/processed/exposure_baselines.json",
                    "geography_presets": "data/processed/geography_presets.json",
                    "evidence_references": "data/processed/evidence_references.json",
                    "scenario_rules": "data/processed/scenario_rules.json",
                },
                "sources": {
                    "onet": "data/raw/onet/",
                    "aioe": "data/raw/aioe/AIOE-main/AIOE_DataAppendix.xlsx",
                    "oecd_ai_exposure": "data/raw/oecd/ai_exposure/OECD AI Capability Gap Index_public data.xlsx",
                    "bls_oews": "data/raw/bls/oesm25nat/national_M2025_dl.xlsx",
                    "evidence_matrix": "data/raw/literature/evidence_matrix.csv",
                },
            },
            f,
            indent=2,
        )
        f.write("\n")

    print(f"Wrote {len(occupations)} occupation profiles")
    print("Wrote exposure_baselines.json, geography_presets.json, evidence_references.json, app_data_manifest.json")


if __name__ == "__main__":
    main()
