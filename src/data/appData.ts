import evidenceReferences from "../../data/processed/evidence_references.json";
import geographyPresets from "../../data/processed/geography_presets.json";
import occupations from "../../data/processed/occupations.json";
import scenarioRules from "../../data/processed/scenario_rules.json";
import type { ScenarioRule } from "../domain/types";

export type OccupationProfile = {
  onet_soc_code: string;
  soc_code: string;
  title: string;
  description: string;
  job_zone: {
    zone: string;
    name: string;
    experience: string;
    education: string;
    job_training: string;
    svp_range: string;
  } | null;
  tasks: Array<{
    id: string;
    text: string;
    type: string;
    importance?: number;
    frequency?: number;
  }>;
  skills: {
    essential: Array<{ id: string; name: string; importance: number; type: string }>;
    transferable: Array<{ id: string; name: string; importance: number; type: string }>;
  };
  work_activities: Array<{ id: string; name: string; importance: number }>;
  employment_wages: {
    employment: number | null;
    hourly_mean_wage: number | null;
    annual_mean_wage: number | null;
    source: string;
  } | null;
  exposure_baseline: {
    combined_score: number | null;
    combined_level: "low" | "medium" | "high" | null;
    aioe: unknown;
    oecd: unknown;
  };
};

export type GeographyPreset = {
  id: string;
  name: string;
  description: string;
  institutional_arrangement: Record<string, string>;
  evidence_ids: string[];
};

export type EvidenceReference = {
  source_id: string;
  citation: string;
  source_type: string;
  source_file: string;
  page_ref: string;
  claim_summary: string;
  evidence_excerpt: string;
  confidence: string;
  verification_status: string;
};

export const appOccupations = occupations as OccupationProfile[];
export const appGeographyPresets = geographyPresets as GeographyPreset[];
export const appEvidenceReferences = evidenceReferences as EvidenceReference[];
export const appScenarioRules = scenarioRules.rules as ScenarioRule[];
