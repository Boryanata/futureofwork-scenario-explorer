#!/usr/bin/env python3
"""Build compact app-ready JSON files from raw datasets and coded evidence."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"

XML_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
XML_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PACKAGE_REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"


JOB_FAMILY_DISPLAY_NAMES = {
    "11-0000": "Management",
    "13-0000": "Business & finance",
    "15-0000": "Computing & mathematics",
    "17-0000": "Architecture & engineering",
    "19-0000": "Science",
    "21-0000": "Community & social services",
    "23-0000": "Legal",
    "25-0000": "Education & libraries",
    "27-0000": "Arts, design & media",
    "29-0000": "Healthcare practitioners",
    "31-0000": "Healthcare support",
    "33-0000": "Protective services",
    "35-0000": "Food preparation & service",
    "37-0000": "Building & grounds maintenance",
    "39-0000": "Personal care & service",
    "41-0000": "Sales",
    "43-0000": "Office & administrative support",
    "45-0000": "Farming, fishing & forestry",
    "47-0000": "Construction & extraction",
    "49-0000": "Installation, maintenance & repair",
    "51-0000": "Production",
    "53-0000": "Transportation & material moving",
    "55-0000": "Military",
}


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


def build_soc_hierarchy(soc_codes: set[str]) -> dict[str, dict]:
    """Build SOC major/minor group labels from the OEWS occupation hierarchy already in the repo."""
    path = RAW / "bls" / "oesm25nat" / "national_M2025_dl.xlsx"
    rows = rows_from_xlsx(path, "national_M2025_dl")
    major_titles = {
        row.get("OCC_CODE", ""): row.get("OCC_TITLE", "")
        for row in rows
        if row.get("O_GROUP") == "major"
    }
    minor_rows = [
        row
        for row in rows
        if row.get("O_GROUP") == "minor"
        and re.match(r"^\d{2}-\d{4}$", row.get("OCC_CODE", ""))
    ]
    minors_by_major: dict[str, list[tuple[int, str, str]]] = defaultdict(list)
    for row in minor_rows:
        code = row["OCC_CODE"]
        major_prefix = code[:2]
        numeric = int(code.replace("-", ""))
        minors_by_major[major_prefix].append((numeric, code, row.get("OCC_TITLE", "")))
    for major_prefix in minors_by_major:
        minors_by_major[major_prefix].sort()

    output: dict[str, dict] = {}

    for code in sorted(soc_codes):
        if not re.match(r"^\d{2}-\d{4}$", code):
            continue
        major_code = f"{code[:2]}-0000"
        code_numeric = int(code.replace("-", ""))
        minor_candidates = [
            item for item in minors_by_major.get(code[:2], [])
            if item[0] <= code_numeric
        ]
        _, minor_code, minor_title = minor_candidates[-1] if minor_candidates else (0, "", "")

        # A parent minor group always shares the detailed occupation's two-digit major group.
        # Choosing the greatest minor-group code not exceeding the detailed code follows the
        # ordered 2018 SOC hierarchy and avoids assuming that the third/fourth digits alone
        # identify the minor group (e.g., Registered Nurses 29-1141 belongs to 29-1000).
        official_family = major_titles.get(major_code, "").removesuffix(" Occupations")
        output[code] = {
            "job_family_code": major_code,
            "job_family": official_family or JOB_FAMILY_DISPLAY_NAMES.get(major_code, "Other occupations"),
            "job_family_display": JOB_FAMILY_DISPLAY_NAMES.get(major_code, official_family or "Other occupations"),
            "subfamily_code": minor_code,
            "subfamily": minor_title.removesuffix(" Occupations"),
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


def normalize_search_text(values: list[str]) -> str:
    text = " ".join(value.strip().lower() for value in values if value and value.strip())
    return re.sub(r"\s+", " ", text).strip()


def normalize_title(value: str) -> str:
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def title_tokens(value: str) -> set[str]:
    stopwords = {"a", "an", "and", "or", "the", "of", "for", "to", "except", "all", "other"}
    tokens = []
    for token in normalize_title(value).split():
        if token in stopwords:
            continue
        if len(token) > 4 and token.endswith("ies"):
            token = token[:-3] + "y"
        elif len(token) > 4 and token.endswith("es") and not token.endswith("ses"):
            token = token[:-2]
        elif len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
            token = token[:-1]
        tokens.append(token)
    return set(tokens)


def title_similarity(canonical: str, candidate: str) -> float:
    canonical_norm = normalize_title(canonical)
    candidate_norm = normalize_title(candidate)
    canonical_tokens = title_tokens(canonical)
    candidate_tokens = title_tokens(candidate)

    sequence = SequenceMatcher(None, canonical_norm, candidate_norm).ratio()
    union = canonical_tokens | candidate_tokens
    overlap = len(canonical_tokens & candidate_tokens) / len(union) if union else 0
    containment = (
        len(canonical_tokens & candidate_tokens) / min(len(canonical_tokens), len(candidate_tokens))
        if canonical_tokens and candidate_tokens
        else 0
    )
    return 0.45 * sequence + 0.30 * overlap + 0.25 * containment


def choose_display_title(canonical: str, candidates: list[tuple[str, str]]) -> tuple[str, str]:
    """Choose a concise O*NET-supported public-facing title without inventing a new occupation label."""
    if not canonical:
        return canonical, "canonical"
    if "all other" in normalize_title(canonical):
        return canonical, "canonical"

    source_bonus = {
        "short_title": 0.12,
        "my_next_move": 0.10,
    }
    canonical_token_count = len(title_tokens(canonical))
    ranked: list[tuple[float, int, str, str]] = []
    seen: set[str] = set()

    for candidate, source in candidates:
        candidate = candidate.strip()
        normalized = normalize_title(candidate)
        if not normalized or normalized in seen or normalized == normalize_title(canonical):
            continue
        seen.add(normalized)

        token_count = len(title_tokens(candidate))
        if not token_count or len(candidate) > 90:
            continue

        score = title_similarity(canonical, candidate) + source_bonus.get(source, 0)
        if canonical_token_count >= 3 and token_count == 1:
            score -= 0.18
        if len(candidate) < len(canonical):
            score += 0.025
        if "(" in candidate or "/" in candidate:
            score -= 0.03

        ranked.append((score, -len(candidate), candidate, source))

    if not ranked:
        return canonical, "canonical"

    best_score, _, best_title, best_source = max(ranked)
    if best_score < 0.72:
        return canonical, "canonical"
    return best_title, best_source


def append_unique_title(
    destination: list[str],
    seen: set[str],
    value: str,
) -> None:
    value = value.strip()
    normalized = normalize_title(value)
    if not normalized or normalized in seen:
        return
    destination.append(value)
    seen.add(normalized)


def build_title_navigation(
    occupation_rows: list[dict],
) -> dict[str, dict]:
    """Build searchable title metadata while keeping occupation labels conservative.

    Ordinary O*NET Job Title values are search aliases only. Public-facing display labels
    may come from the canonical O*NET title, an explicit O*NET Short Title, or (when the
    optional file is present) a title O*NET marks for display in My Next Move.
    """
    available_codes = {row["O*NET-SOC Code"] for row in occupation_rows}
    canonical_titles = {row["O*NET-SOC Code"]: row["Title"] for row in occupation_rows}

    aliases: dict[str, list[str]] = defaultdict(list)
    alias_seen: dict[str, set[str]] = defaultdict(set)
    display_candidates: dict[str, list[tuple[str, str]]] = defaultdict(list)

    for row in read_csv(RAW / "onet" / "job_titles.csv"):
        code = row.get("O*NET-SOC Code", "")
        if code not in available_codes:
            continue

        short_title = row.get("Short Title", "").strip()
        job_title = row.get("Job Title", "").strip()

        if short_title:
            append_unique_title(aliases[code], alias_seen[code], short_title)
            display_candidates[code].append((short_title, "short_title"))
        if job_title:
            # Alternate job titles improve search recall, but they do not rename the
            # underlying occupation in the interface.
            append_unique_title(aliases[code], alias_seen[code], job_title)

    reported_path = RAW / "onet" / "sample_of_reported_titles.csv"
    if reported_path.exists():
        for row in read_csv(reported_path):
            code = row.get("O*NET-SOC Code", "")
            if code not in available_codes:
                continue
            reported = row.get("Reported Job Title", "").strip()
            if not reported:
                continue
            append_unique_title(aliases[code], alias_seen[code], reported)
            if row.get("Shown in My Next Move", "").strip().upper() == "Y":
                display_candidates[code].append((reported, "my_next_move"))

    output: dict[str, dict] = {}
    for code in available_codes:
        canonical = canonical_titles.get(code, "")
        display_title, display_source = choose_display_title(canonical, display_candidates.get(code, []))
        display_norm = normalize_title(display_title)
        canonical_norm = normalize_title(canonical)
        clean_aliases = [
            alias
            for alias in aliases.get(code, [])
            if normalize_title(alias) not in {display_norm, canonical_norm}
        ]
        output[code] = {
            "display_title": display_title,
            "display_title_source": display_source,
            "search_aliases": clean_aliases,
        }
    return output


def build_occupations() -> list[dict]:
    tasks = build_tasks()
    essential = top_by_importance(read_csv(RAW / "onet" / "essential_skills.csv"), "O*NET-SOC Code", 6, "essential")
    transferable = top_by_importance(read_csv(RAW / "onet" / "transferable_skills.csv"), "O*NET-SOC Code", 6, "transferable")
    activities = top_by_importance(read_csv(RAW / "onet" / "work_activities.csv"), "O*NET-SOC Code", 8)
    job_zones = build_job_zones()
    bls = build_bls_national()
    aioe = build_aioe()
    oecd = build_oecd_exposure()
    occupation_rows = read_csv(RAW / "onet" / "occupation_data.csv")
    soc_hierarchy = build_soc_hierarchy({soc6(row["O*NET-SOC Code"]) for row in occupation_rows})
    title_navigation = build_title_navigation(occupation_rows)

    occupations = []
    for row in occupation_rows:
        code = row["O*NET-SOC Code"]
        six = soc6(code)
        navigation = title_navigation.get(code, {})
        hierarchy = soc_hierarchy.get(six, {})
        aliases = navigation.get("search_aliases", [])
        display_title = navigation.get("display_title", row["Title"])
        occupation = {
            "onet_soc_code": code,
            "soc_code": six,
            "title": row["Title"],
            "onet_title": row["Title"],
            "display_title": display_title,
            "display_title_source": navigation.get("display_title_source", "canonical"),
            "description": row["Description"],
            "job_family_code": hierarchy.get("job_family_code", ""),
            "job_family": hierarchy.get("job_family", ""),
            "job_family_display": hierarchy.get("job_family_display", hierarchy.get("job_family", "")),
            "subfamily_code": hierarchy.get("subfamily_code", ""),
            "subfamily": hierarchy.get("subfamily", ""),
            "search_aliases": aliases,
            "search_text": normalize_search_text([
                display_title,
                row["Title"],
                hierarchy.get("job_family", ""),
                hierarchy.get("job_family_display", ""),
                hierarchy.get("subfamily", ""),
                *aliases,
            ]),
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

    return sorted(occupations, key=lambda item: (item["display_title"], item["title"], item["onet_soc_code"]))


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
                    "onet_job_titles": "data/raw/onet/job_titles.csv",
                    "onet_reported_titles_optional": "data/raw/onet/sample_of_reported_titles.csv",
                    "soc_hierarchy": "derived from BLS OEWS occupational group rows",
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

    display_sources = Counter(occupation["display_title_source"] for occupation in occupations)
    public_title_count = sum(1 for occupation in occupations if occupation["display_title_source"] != "canonical")
    print(f"Wrote {len(occupations)} occupation profiles")
    print(f"Using {public_title_count} explicit O*NET public/short titles; canonical titles retained for the rest")
    print(f"Display-title sources: {dict(sorted(display_sources.items()))}")
    print("Wrote exposure_baselines.json, geography_presets.json, evidence_references.json, app_data_manifest.json")


if __name__ == "__main__":
    main()
