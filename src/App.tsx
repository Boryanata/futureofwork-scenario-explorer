import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  FileText,
  Gauge,
  GraduationCap,
  Layers3,
  Lock,
  MoveHorizontal,
  Search,
  SlidersHorizontal,
  UsersRound,
  Workflow,
} from "lucide-react";
import {
  appEvidenceReferences,
  appOccupations,
  appScenarioRules,
  type EvidenceReference,
  type OccupationProfile,
} from "./data/appData";
import { evaluateScenario } from "./domain/scenarioEngine";
import { formatOutcomeLabel } from "./domain/explanations";
import FrameworkArticle from "./FrameworkArticle";
import type {
  OutcomeDimension,
  OutcomeResult,
  ScenarioContext,
  ScenarioResult,
  ScenarioRule,
} from "./domain/types";

type Preset = {
  id: string;
  label: string;
  shortLabel: string;
  summary: string;
  values: Record<string, string | boolean>;
};

type ControlConfig = {
  field: string;
  label: string;
  shortLabel?: string;
  options: string[];
};

type WorkDesign = {
  label: string;
  summary: string;
  aiShare: number;
  humanShare: number;
  aiRole: string;
  humanRole: string;
  learningNote: string;
};

type WorkLane = "human" | "shared" | "ai";

type WorkTask = OccupationProfile["tasks"][number];

type TaskAssignment = {
  task: WorkTask;
  lane: WorkLane;
  rationale: string;
};

type OrganizationalContextCue = {
  level: "supported" | "mixed" | "constrained";
  label: "More supported" | "Mixed support" | "More constrained";
  arrow: "↑" | "→" | "↓";
  explanation: string;
};

type ComparisonSnapshot = {
  occupationCode: string;
  occupationTitle: string;
  exposureLevel: string;
  exposureScore: number | null;
  comparisonSignature: string;
  institutionLabel: string;
  organizationLabel: string;
  workDesign: WorkDesign;
  result: ScenarioResult;
};

type OccupationSearchMatch = {
  item: OccupationProfile;
  tier: number;
  matchType: "occupation" | "job_title";
  matchedAlias?: string;
};

type SearchResultSection = {
  heading?: string;
  familyCode?: string;
  subfamilyCode?: string;
  items: OccupationSearchMatch[];
};

type OccupationFamily = {
  code: string;
  label: string;
  items: OccupationProfile[];
};

type OccupationSubfamily = {
  code: string;
  label: string;
  items: OccupationProfile[];
};

type ComparativeCase = {
  id: string;
  country: string;
  descriptor: string;
  summary: string;
  presetId: string;
  geography: string;
  overrides: Record<string, string>;
};

const institutionalPresets: Preset[] = [
  {
    id: "industry_led",
    label: "Industry-led adaptation",
    shortLabel: "Industry-led",
    summary: "Light-touch regulation · high employer discretion · limited public coordination",
    values: {
      ai_governance: "weak",
      algorithmic_transparency: "limited",
      worker_information_rights: "limited",
      data_protection: "weak",
      anti_discrimination_rules: "weak",
      collective_bargaining: "weak",
      workforce_development: "weak",
      employer_retraining_incentives: "low",
      active_labor_market_policy: "weak",
      social_protection: "minimal",
      employment_protection: "weak",
    },
  },
  {
    id: "publicly_coordinated",
    label: "Publicly coordinated adaptation",
    shortLabel: "Publicly coordinated",
    summary: "Public investment · workforce infrastructure · transition support · regulatory coordination",
    values: {
      ai_governance: "moderate",
      algorithmic_transparency: "moderate",
      worker_information_rights: "moderate",
      data_protection: "moderate",
      anti_discrimination_rules: "moderate",
      collective_bargaining: "moderate",
      workforce_development: "strong",
      employer_retraining_incentives: "moderate",
      active_labor_market_policy: "strong",
      social_protection: "moderate",
      employment_protection: "moderate",
    },
  },
  {
    id: "worker_negotiated",
    label: "Worker-negotiated adaptation",
    shortLabel: "Worker-negotiated",
    summary: "Collective bargaining · worker voice · negotiated deployment · shared adjustment",
    values: {
      ai_governance: "co_governed",
      algorithmic_transparency: "strong",
      worker_information_rights: "strong",
      data_protection: "strong",
      anti_discrimination_rules: "strong",
      collective_bargaining: "strong",
      workforce_development: "strong",
      employer_retraining_incentives: "high",
      active_labor_market_policy: "strong",
      social_protection: "strong",
      employment_protection: "strong",
    },
  },
];

const organizationalPresets: Preset[] = [
  {
    id: "automation_oriented",
    label: "Automation-oriented",
    shortLabel: "Automation-oriented",
    summary: "Task substitution is prioritized, with limited redesign or retraining.",
    values: {
      deployment_strategy: "automation_first",
      retraining_commitment: "none",
      worker_participation: "low",
      worker_consultation_rights: "weak",
      human_oversight: "low",
      task_allocation: "unclear",
      task_meaning: "high",
      skill_investment_horizon: "short",
      job_redesign: "inactive",
      ai_adoption_stage: "post_deployment",
      hiring_screening_ai: false,
    },
  },
  {
    id: "hybrid_redesign",
    label: "Hybrid work redesign",
    shortLabel: "Hybrid redesign",
    summary: "Some tasks are automated while others are reorganized around human-AI collaboration.",
    values: {
      deployment_strategy: "hybrid",
      retraining_commitment: "selective",
      worker_participation: "medium",
      worker_consultation_rights: "moderate",
      human_oversight: "medium",
      task_allocation: "clear",
      task_meaning: "high",
      skill_investment_horizon: "medium",
      job_redesign: "active",
      ai_adoption_stage: "post_deployment",
      hiring_screening_ai: false,
    },
  },
  {
    id: "augmentation_redeployment",
    label: "Augmentation + redeployment",
    shortLabel: "Augmentation + redeployment",
    summary: "AI supports work while jobs, skills, and internal mobility pathways are redesigned.",
    values: {
      deployment_strategy: "augmentation",
      retraining_commitment: "broad",
      worker_participation: "high",
      worker_consultation_rights: "strong",
      human_oversight: "required",
      task_allocation: "clear",
      task_meaning: "high",
      skill_investment_horizon: "long",
      job_redesign: "active",
      ai_adoption_stage: "pre_deployment",
      hiring_screening_ai: false,
    },
  },
];

const institutionalControls: ControlConfig[] = [
  { field: "ai_governance", label: "AI governance", shortLabel: "AI governance", options: ["weak", "moderate", "co_governed", "rights_based"] },
  { field: "algorithmic_transparency", label: "Algorithmic transparency", shortLabel: "Transparency", options: ["limited", "moderate", "strong"] },
  { field: "worker_information_rights", label: "Worker information rights", shortLabel: "Information rights", options: ["limited", "moderate", "strong"] },
  { field: "data_protection", label: "Data protection", shortLabel: "Data protection", options: ["weak", "moderate", "strong"] },
  { field: "anti_discrimination_rules", label: "Anti-discrimination rules", shortLabel: "Anti-discrimination", options: ["weak", "moderate", "strong"] },
  { field: "collective_bargaining", label: "Collective bargaining", shortLabel: "Collective bargaining", options: ["weak", "moderate", "strong"] },
  { field: "workforce_development", label: "Workforce development", shortLabel: "Workforce development", options: ["weak", "moderate", "strong"] },
  { field: "employer_retraining_incentives", label: "Employer retraining incentives", shortLabel: "Retraining incentives", options: ["low", "moderate", "high"] },
  { field: "active_labor_market_policy", label: "Active labor market policy", shortLabel: "Active labor policy", options: ["weak", "moderate", "strong"] },
  { field: "social_protection", label: "Social protection", shortLabel: "Social protection", options: ["minimal", "moderate", "strong"] },
  { field: "employment_protection", label: "Employment protection", shortLabel: "Employment protection", options: ["weak", "moderate", "strong"] },
];

const institutionalDetailGroups = [
  {
    title: "Governance and rights",
    fields: [
      "ai_governance",
      "algorithmic_transparency",
      "worker_information_rights",
      "data_protection",
      "anti_discrimination_rules",
    ],
  },
  {
    title: "Worker power and protection",
    fields: ["collective_bargaining", "employment_protection", "social_protection"],
  },
  {
    title: "Adaptation and workforce capacity",
    fields: ["workforce_development", "employer_retraining_incentives", "active_labor_market_policy"],
  },
];

const institutionalDimensionCopy: Record<string, { explanation: string; why?: string }> = {
  ai_governance: {
    explanation: "Rules and oversight shape how AI can be introduced and used.",
    why: "Governance sets the conditions under which organizations adopt and deploy AI.",
  },
  algorithmic_transparency: {
    explanation: "People can see or understand when automated systems are being used and how decisions are made.",
    why: "Transparency makes it easier to question, improve, or contest AI-driven decisions.",
  },
  worker_information_rights: {
    explanation: "Workers have access to information about technologies that affect their jobs or working conditions.",
    why: "Information rights help workers and representatives respond before changes are locked in.",
  },
  data_protection: {
    explanation: "Limits exist on how worker data can be collected, used, shared, and stored.",
    why: "Data protections reduce the risk of excessive monitoring or misuse of personal information.",
  },
  anti_discrimination_rules: {
    explanation: "Rules aim to prevent automated systems from producing unfair or biased outcomes.",
    why: "Anti-discrimination safeguards matter when AI affects hiring, scheduling, evaluation, or advancement.",
  },
  collective_bargaining: {
    explanation: "Workers have an organized channel to negotiate over workplace change.",
    why: "Worker voice can affect how the costs and gains of technological change are negotiated.",
  },
  employment_protection: {
    explanation: "Rules shape how easily jobs can be changed, reduced, or ended.",
    why: "Employment protection can slow abrupt displacement and create space for transition planning.",
  },
  social_protection: {
    explanation: "Income support and public benefits help workers manage employment disruption.",
    why: "Stronger protections can reduce the individual risk of moving between jobs or training pathways.",
  },
  workforce_development: {
    explanation: "Publicly supported training and transition infrastructure helps workers build new skills.",
    why: "Stronger training systems increase the capacity to respond to changing skill and employment demands.",
  },
  employer_retraining_incentives: {
    explanation: "Employers face incentives or expectations to invest in retraining workers.",
    why: "Retraining incentives can make adaptation more likely to happen inside jobs, not only after displacement.",
  },
  active_labor_market_policy: {
    explanation: "Public programs help workers find work, retrain, or move into growing roles.",
    why: "Active labor-market support can improve mobility when work changes.",
  },
};

const organizationControls: ControlConfig[] = [
  { field: "deployment_strategy", label: "Deployment strategy", options: ["automation_first", "hybrid", "augmentation"] },
  { field: "retraining_commitment", label: "Retraining / role transition", options: ["none", "selective", "broad"] },
  { field: "worker_participation", label: "Worker participation in work redesign", options: ["low", "medium", "high"] },
  { field: "worker_consultation_rights", label: "Worker consultation", options: ["weak", "moderate", "strong"] },
  { field: "human_oversight", label: "Human oversight", options: ["low", "medium", "high", "required"] },
  { field: "task_allocation", label: "Task allocation", options: ["unclear", "clear"] },
  { field: "task_meaning", label: "Task meaning", options: ["low", "high"] },
  { field: "skill_investment_horizon", label: "Skill investment horizon", options: ["short", "medium", "long"] },
  { field: "job_redesign", label: "Job redesign", options: ["inactive", "active"] },
  { field: "ai_adoption_stage", label: "AI adoption stage", options: ["post_deployment", "pre_deployment"] },
];

const additionalOrganizationFields = [
  "worker_consultation_rights",
  "human_oversight",
  "skill_investment_horizon",
  "job_redesign",
  "ai_adoption_stage",
] as const;

const organizationalDimensionCopy: Record<string, string> = {
  worker_consultation_rights:
    "Whether workers are informed and consulted before or during AI-related changes to work, monitoring, or roles.",
  human_oversight:
    "How much human review, judgment, or decision-making is retained when AI is used.",
  skill_investment_horizon:
    "Whether employer skill investment focuses on immediate deployment needs or workers' longer-term development.",
  job_redesign:
    "Whether roles and responsibilities are deliberately reorganized as AI is introduced.",
  ai_adoption_stage:
    "Whether workforce considerations enter before deployment or mainly after AI has already been introduced.",
};

const comparativeCases: ComparativeCase[] = [
  {
    id: "us_fragmented",
    country: "United States/NYC",
    descriptor: "Fragmented adaptation",
    summary: "Fragmented workforce institutions, substantial employer discretion, and uneven public supports.",
    presetId: "industry_led",
    geography: "nyc",
    overrides: {
      workforce_development: "moderate",
      employer_retraining_incentives: "moderate",
      active_labor_market_policy: "moderate",
      data_protection: "moderate",
      anti_discrimination_rules: "moderate",
    },
  },
  {
    id: "singapore_skills",
    country: "Singapore",
    descriptor: "Coordinated skills adaptation",
    summary: "Public coordination, employer incentives, tripartite institutions, and strong workforce-development capacity.",
    presetId: "publicly_coordinated",
    geography: "singapore",
    overrides: {
      workforce_development: "strong",
      employer_retraining_incentives: "high",
      active_labor_market_policy: "strong",
      social_protection: "moderate",
    },
  },
  {
    id: "denmark_negotiated",
    country: "Denmark",
    descriptor: "Negotiated transition",
    summary: "Collective bargaining, social protection, active labor-market policy, and negotiated adjustment.",
    presetId: "worker_negotiated",
    geography: "denmark",
    overrides: {
      employment_protection: "moderate",
      social_protection: "strong",
      active_labor_market_policy: "strong",
      collective_bargaining: "strong",
      workforce_development: "strong",
    },
  },
];

const directionMeta: Record<OutcomeDimension, { left: string; right: string }> = {
  employment: { left: "weaker employment outlook", right: "stronger employment outlook" },
  wages: { left: "downward wage pressure", right: "upward wage potential" },
  mobility: { left: "lower mobility", right: "greater mobility" },
  productivity: { left: "lower productivity potential", right: "higher productivity potential" },
  redeployment: { left: "weaker redeployment capacity", right: "stronger redeployment capacity" },
  displacement: { left: "higher displacement pressure", right: "lower displacement pressure" },
  skill_accumulation: { left: "skill erosion", right: "skill accumulation" },
  job_quality: { left: "job-quality pressure", right: "stronger job quality" },
  distribution_of_gains: { left: "more concentrated gains", right: "more broadly shared gains" },
};

function comparativeCaseValues(referenceCase: ComparativeCase): Record<string, string | boolean> {
  const preset = institutionalPresets.find((item) => item.id === referenceCase.presetId) ?? institutionalPresets[0];
  return { ...preset.values, ...referenceCase.overrides };
}

function largestInstitutionalContrasts(
  currentValues: Record<string, string | boolean>,
  referenceValues: Record<string, string | boolean>,
  limit = 5,
) {
  return institutionalControls
    .map((control) => {
      const currentValue = String(currentValues[control.field]);
      const referenceValue = String(referenceValues[control.field]);
      return {
        label: control.shortLabel ?? control.label,
        currentValue,
        referenceValue,
        difference: Math.abs(
          normalizeDimension(control, currentValue) - normalizeDimension(control, referenceValue),
        ),
      };
    })
    .filter((item) => item.currentValue !== item.referenceValue)
    .sort((a, b) => b.difference - a.difference)
    .slice(0, limit);
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function preparationLabel(occupation: OccupationProfile): string {
  if (!occupation.job_zone) return "Not available";
  return occupation.job_zone.name.replace(/^Job Zone\s(?:[\d-]+|[A-Za-z]+):\s*/, "");
}

function occupationDisplayTitle(occupation: OccupationProfile): string {
  return occupation.display_title || occupation.title;
}

function findOccupation(defaultTitle: string): OccupationProfile {
  const normalizedDefault = normalizeSearchValue(defaultTitle);
  return (
    appOccupations.find(
      (occupation) =>
        normalizeSearchValue(occupationDisplayTitle(occupation)) === normalizedDefault ||
        normalizeSearchValue(occupation.title) === normalizedDefault,
    ) ?? appOccupations[0]
  );
}

function normalizeSearchValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTokens(value: string): string[] {
  return normalizeSearchValue(value)
    .split(/[\s/-]+/)
    .filter(Boolean);
}

function tokenPrefixMatch(value: string, query: string): boolean {
  const valueTokens = searchTokens(value);
  const queryTokens = searchTokens(query);
  if (!queryTokens.length) return false;

  let valueIndex = 0;
  for (const queryToken of queryTokens) {
    let found = false;
    while (valueIndex < valueTokens.length) {
      if (valueTokens[valueIndex].startsWith(queryToken)) {
        found = true;
        valueIndex += 1;
        break;
      }
      valueIndex += 1;
    }
    if (!found) return false;
  }

  return true;
}

function directOccupationMatchTier(occupation: OccupationProfile, query: string): number | null {
  const normalizedDisplayTitle = normalizeSearchValue(occupationDisplayTitle(occupation));
  const normalizedCanonicalTitle = normalizeSearchValue(occupation.title);

  if (normalizedDisplayTitle === query) return 1;
  if (normalizedCanonicalTitle === query) return 2;

  if (normalizedDisplayTitle.startsWith(query)) return 3;
  if (normalizedCanonicalTitle.startsWith(query)) return 4;

  if (tokenPrefixMatch(normalizedDisplayTitle, query)) return 5;
  if (tokenPrefixMatch(normalizedCanonicalTitle, query)) return 6;

  return null;
}

function bestAliasMatch(
  occupation: OccupationProfile,
  query: string,
): { alias: string; tier: number } | null {
  if (!query) return null;

  const matches = occupation.search_aliases
    .map((alias, index) => ({ alias, index, normalized: normalizeSearchValue(alias) }))
    .map((match) => {
      let tier: number | null = null;
      if (match.normalized === query) tier = 1;
      else if (match.normalized.startsWith(query)) tier = 2;
      else if (tokenPrefixMatch(match.normalized, query)) tier = 3;
      return { ...match, tier };
    })
    .filter((match): match is { alias: string; index: number; normalized: string; tier: number } => match.tier !== null)
    .sort((a, b) => a.tier - b.tier || a.normalized.length - b.normalized.length || a.index - b.index);

  const match = matches[0];
  return match ? { alias: match.alias, tier: match.tier } : null;
}

function buildSearchResultSections(results: OccupationSearchMatch[]): SearchResultSection[] {
  if (results.length <= 8) {
    return [{ items: results }];
  }

  const families = new Set(
    results.map(({ item }) => item.job_family_code || item.job_family_display),
  );
  const multipleFamilies = families.size > 1;
  const sections = new Map<string, SearchResultSection>();

  for (const match of results) {
    const item = match.item;
    const familyLabel = item.job_family_display || item.job_family || "Other occupations";
    const subfamilyLabel = item.subfamily || familyLabel;
    const key = `${item.job_family_code}|${item.subfamily_code}|${subfamilyLabel}`;
    const heading =
      multipleFamilies && subfamilyLabel !== familyLabel
        ? `${familyLabel} · ${subfamilyLabel}`
        : subfamilyLabel;

    const current = sections.get(key);
    if (current) {
      current.items.push(match);
    } else {
      sections.set(key, {
        heading,
        familyCode: item.job_family_code,
        subfamilyCode: item.subfamily_code,
        items: [match],
      });
    }
  }

  return Array.from(sections.values()).sort((a, b) => {
    const countOrder = b.items.length - a.items.length;
    if (countOrder !== 0) return countOrder;

    const familyOrder = (a.familyCode ?? "").localeCompare(b.familyCode ?? "", undefined, { numeric: true });
    if (familyOrder !== 0) return familyOrder;

    const subfamilyOrder = (a.subfamilyCode ?? "").localeCompare(b.subfamilyCode ?? "", undefined, { numeric: true });
    if (subfamilyOrder !== 0) return subfamilyOrder;

    return (a.heading ?? "").localeCompare(b.heading ?? "");
  });
}

function buildOccupationFamilies(occupations: OccupationProfile[]): OccupationFamily[] {
  const families = new Map<string, OccupationFamily>();

  for (const occupation of occupations) {
    const code = occupation.job_family_code || "other";
    const label = occupation.job_family_display || occupation.job_family || "Other occupations";
    const current = families.get(code);
    if (current) {
      current.items.push(occupation);
    } else {
      families.set(code, { code, label, items: [occupation] });
    }
  }

  return Array.from(families.values())
    .map((family) => ({
      ...family,
      items: [...family.items].sort((a, b) =>
        occupationDisplayTitle(a).localeCompare(occupationDisplayTitle(b)),
      ),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function buildOccupationSubfamilies(family: OccupationFamily): OccupationSubfamily[] {
  const subfamilies = new Map<string, OccupationSubfamily>();

  for (const occupation of family.items) {
    const code = occupation.subfamily_code || occupation.job_family_code || "other";
    const label = occupation.subfamily || family.label;
    const current = subfamilies.get(code);
    if (current) {
      current.items.push(occupation);
    } else {
      subfamilies.set(code, { code, label, items: [occupation] });
    }
  }

  return Array.from(subfamilies.values()).sort((a, b) => a.code.localeCompare(b.code));
}

function taskAffinity(task: WorkTask): { routine: number; human: number; oversight: number } {
  const text = task.text.toLowerCase();
  const routine = [
    "record",
    "compile",
    "process",
    "calculate",
    "prepare",
    "enter",
    "update",
    "schedule",
    "file",
    "monitor",
  ].reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
  const human = [
    "advise",
    "communicate",
    "coordinate",
    "counsel",
    "explain",
    "interview",
    "negotiate",
    "supervise",
    "teach",
    "train",
  ].reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
  const oversight = [
    "evaluate",
    "inspect",
    "interpret",
    "review",
    "verify",
    "resolve",
    "decide",
    "determine",
  ].reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);

  return { routine, human, oversight };
}

function compactTaskText(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}...` : text;
}

function buildContext(
  occupation: OccupationProfile,
  geography: string,
  institutionalValues: Record<string, string | boolean>,
  organizationalValues: Record<string, string | boolean>,
): ScenarioContext {
  return {
    occupation: {
      onetSocCode: occupation.onet_soc_code,
      socCode: occupation.soc_code,
      title: occupation.title,
    },
    ai_exposure: occupation.exposure_baseline.combined_level ?? "medium",
    geography,
    ...institutionalValues,
    ...organizationalValues,
  };
}

function orderedScenarioValues(
  controls: ControlConfig[],
  values: Record<string, string | boolean>,
): Array<[string, string | boolean]> {
  const controlFields = controls.map((control) => control.field);
  const remainingFields = Object.keys(values)
    .filter((field) => !controlFields.includes(field))
    .sort();
  return [...controlFields, ...remainingFields].map((field) => [field, values[field]]);
}

function buildComparisonSignature(
  occupation: OccupationProfile,
  geography: string,
  institutionalValues: Record<string, string | boolean>,
  organizationalValues: Record<string, string | boolean>,
): string {
  return JSON.stringify({
    occupationCode: occupation.onet_soc_code,
    geography,
    institutionalValues: orderedScenarioValues(institutionalControls, institutionalValues),
    organizationalValues: orderedScenarioValues(organizationControls, organizationalValues),
  });
}

function getPresetLabel(preset: Preset, overrides: Record<string, unknown>): string {
  return Object.keys(overrides).length ? `Modified ${preset.label}` : preset.label;
}

function deriveWorkDesign(
  institutionalValues: Record<string, string | boolean>,
  organizationalValues: Record<string, string | boolean>,
): WorkDesign {
  const deployment = String(organizationalValues.deployment_strategy);
  const retraining = String(organizationalValues.retraining_commitment);
  const participation = String(organizationalValues.worker_participation);
  const bargaining = String(institutionalValues.collective_bargaining);
  const workforce = String(institutionalValues.workforce_development);
  const oversight = String(organizationalValues.human_oversight);

  if (deployment === "automation_first") {
    const constrained = ["strong", "moderate"].includes(bargaining) || workforce === "strong" || ["high", "required"].includes(oversight);
    return constrained
      ? {
          label: "Substitution-centered work design",
          summary: "The organization still prioritizes substitution, but institutional supports and oversight place limits on how far that strategy can travel.",
          aiShare: 66,
          humanShare: 34,
          aiRole: "Routine production, first-pass processing, standardized decisions",
          humanRole: "Exception handling, judgment, oversight, relationship-intensive work",
          learningNote: retraining === "broad" ? "Retraining creates a pathway into redesigned roles." : "Learning pathways remain uneven despite stronger external constraints.",
        }
      : {
          label: "Substitution-centered work design",
          summary: "AI absorbs a larger share of routine and standardized work while worker voice, retraining, and transition supports remain limited.",
          aiShare: 76,
          humanShare: 24,
          aiRole: "Routine production, standardized processing, monitoring",
          humanRole: "Residual judgment, exceptions, escalation",
          learningNote: "The design risks removing tasks that previously supported learning and progression.",
        };
  }

  if (deployment === "hybrid") {
    return {
      label: "Hybrid task redesign",
      summary: "Automation and augmentation coexist. The labor pathway depends on which tasks are redesigned, which are removed, and where training is actually available.",
      aiShare: 49,
      humanShare: 51,
      aiRole: "Drafting, routine analysis, standardized processing",
      humanRole: "Judgment, contextual interpretation, interpersonal work, escalation",
      learningNote: workforce === "strong" ? "External training capacity makes adaptation more feasible." : "Learning opportunities depend heavily on firm-level implementation.",
    };
  }

  const participatory = participation === "high" || bargaining === "strong";
  return participatory
    ? {
        label: "Augmentation + redeployment work design",
        summary: "AI supports selected tasks while worker participation, oversight, and skill investment shape how jobs are redesigned.",
        aiShare: 34,
        humanShare: 66,
        aiRole: "Routine support, drafting, pattern detection, administrative load",
        humanRole: "Judgment, client interaction, learning, coordination, accountability",
        learningNote: "Human work retains tasks that build expertise while AI absorbs selected routine load.",
      }
    : {
        label: "Augmentation + redeployment work design",
        summary: "AI is oriented toward support rather than pure substitution, but the quality of redesign remains dependent on employer choices.",
        aiShare: 40,
        humanShare: 60,
        aiRole: "Routine support, drafting, analysis assistance",
        humanRole: "Judgment, relationship work, verification, coordination",
        learningNote: "Skill gains are possible, but they are not institutionally guaranteed.",
      };
}

function scenarioTaskAssignment(
  task: WorkTask,
  institutionalValues: Record<string, string | boolean>,
  organizationalValues: Record<string, string | boolean>,
): TaskAssignment {
  const affinity = taskAffinity(task);
  const deployment = String(organizationalValues.deployment_strategy);
  const oversight = String(organizationalValues.human_oversight);
  const participation = String(organizationalValues.worker_participation);
  const retraining = String(organizationalValues.retraining_commitment);
  const bargaining = String(institutionalValues.collective_bargaining);
  const informationRights = String(institutionalValues.worker_information_rights);

  let lane: WorkLane = "shared";

  if (deployment === "automation_first") {
    if (affinity.human >= 2 || (affinity.oversight > 0 && ["high", "required"].includes(oversight))) {
      lane = "human";
    } else if (affinity.routine > affinity.human) {
      lane = "ai";
    } else {
      lane = "shared";
    }
  } else if (deployment === "hybrid") {
    if (affinity.human > affinity.routine || affinity.oversight > 0) {
      lane = "human";
    } else if (affinity.routine >= 2) {
      lane = "ai";
    } else {
      lane = "shared";
    }
  } else {
    if (affinity.human > 0 || affinity.oversight > 0) {
      lane = "human";
    } else {
      lane = "shared";
    }
  }

  const participatoryContext = participation === "high" || bargaining === "strong" || informationRights === "strong";
  if (participatoryContext && lane === "ai" && affinity.oversight > 0) lane = "shared";
  if (retraining === "broad" && lane === "ai" && affinity.human > 0) lane = "shared";

  const rationale =
    lane === "human"
      ? "This task is kept human-led in the scenario because its wording emphasizes judgment, interaction, oversight, or responsibility."
      : lane === "ai"
        ? "This task is shown as AI-led because the scenario prioritizes automation and the task wording suggests standardized, record-based, or routine processing."
        : "This task is placed in shared work because the scenario combines AI support with human judgment, oversight, or redesign rather than treating the task as fully delegated.";

  return { task, lane, rationale };
}

function buildScenarioTaskAssignments(
  occupation: OccupationProfile,
  institutionalValues: Record<string, string | boolean>,
  organizationalValues: Record<string, string | boolean>,
): TaskAssignment[] {
  return occupation.tasks
    .slice(0, 7)
    .map((task) => scenarioTaskAssignment(task, institutionalValues, organizationalValues));
}

function organizationDecisionCopy(
  occupation: OccupationProfile,
  field: string,
  value: string,
): string {
  const occupationTitle = occupationDisplayTitle(occupation);

  if (field === "deployment_strategy") {
    if (value === "automation_first") {
      return `The employer prioritizes substituting automatable parts of ${occupationTitle} work rather than redesigning roles around AI support.`;
    }
    if (value === "hybrid") {
      return `The employer combines targeted automation with redesign of ${occupationTitle} workflows around human-AI collaboration.`;
    }
    return `AI is used primarily to support ${occupationTitle} work while retaining and redesigning human responsibilities.`;
  }

  if (field === "retraining_commitment") {
    if (value === "none") {
      return `There is no planned investment in preparing ${occupationTitle} workers for changing responsibilities or adjacent roles.`;
    }
    if (value === "selective") {
      return `Training is targeted to ${occupationTitle} workers or responsibilities most directly affected by AI deployment.`;
    }
    return `The employer builds broader retraining and role-transition pathways for ${occupationTitle} workers alongside AI deployment.`;
  }

  if (field === "worker_participation") {
    if (value === "low") {
      return `Work redesign is primarily management-led, with limited ${occupationTitle} worker influence over how AI changes everyday work.`;
    }
    if (value === "medium") {
      return `${occupationTitle} workers are consulted about changes to workflows, responsibilities, and the introduction of AI.`;
    }
    return `${occupationTitle} workers participate directly in decisions about how AI changes workflows and responsibilities.`;
  }

  return `This choice changes how ${occupationTitle} work is organized under the scenario.`;
}


function institutionalLevel(
  field: string,
  values: Record<string, string | boolean>,
): number {
  const control = institutionalControls.find((item) => item.field === field);
  if (!control) return 0.5;

  const value = String(values[field]);
  const index = control.options.indexOf(value);
  if (index < 0 || control.options.length <= 1) return 0.5;

  return index / (control.options.length - 1);
}

function organizationalContextCue(
  presetId: string,
  institutionalValues: Record<string, string | boolean>,
): OrganizationalContextCue {
  let support = 0.5;

  if (presetId === "automation_oriented") {
    const constraints = [
      institutionalLevel("ai_governance", institutionalValues),
      institutionalLevel("collective_bargaining", institutionalValues),
      institutionalLevel("worker_information_rights", institutionalValues),
      institutionalLevel("employment_protection", institutionalValues),
    ];
    support = 1 - constraints.reduce((sum, value) => sum + value, 0) / constraints.length;

    if (support >= 0.66) {
      return {
        level: "supported",
        label: "More supported",
        arrow: "↑",
        explanation:
          "Limited bargaining, information rights, and employment protections leave employers more room to pursue a substitution-first strategy.",
      };
    }

    if (support <= 0.34) {
      return {
        level: "constrained",
        label: "More constrained",
        arrow: "↓",
        explanation:
          "Stronger bargaining, worker information rights, and employment protection place more constraints on a substitution-first strategy.",
      };
    }

    return {
      level: "mixed",
      label: "Mixed support",
      arrow: "→",
      explanation:
        "Some institutional constraints temper employer discretion, but they do not rule out a substitution-first strategy.",
    };
  }

  if (presetId === "hybrid_redesign") {
    const supports = [
      institutionalLevel("workforce_development", institutionalValues),
      institutionalLevel("employer_retraining_incentives", institutionalValues),
      institutionalLevel("worker_information_rights", institutionalValues),
    ];
    support = supports.reduce((sum, value) => sum + value, 0) / supports.length;

    if (support >= 0.66) {
      return {
        level: "supported",
        label: "More supported",
        arrow: "↑",
        explanation:
          "Training infrastructure, retraining incentives, and worker information rights make coordinated work redesign easier to sustain.",
      };
    }

    if (support <= 0.34) {
      return {
        level: "constrained",
        label: "More constrained",
        arrow: "↓",
        explanation:
          "Limited training infrastructure and retraining support make coordinated work redesign harder to sustain.",
      };
    }

    return {
      level: "mixed",
      label: "Mixed support",
      arrow: "→",
      explanation:
        "Some supports for retraining and redesign are present, while implementation still depends heavily on employer capacity.",
    };
  }

  const supports = [
    institutionalLevel("workforce_development", institutionalValues),
    institutionalLevel("employer_retraining_incentives", institutionalValues),
    institutionalLevel("active_labor_market_policy", institutionalValues),
    institutionalLevel("collective_bargaining", institutionalValues),
  ];
  support = supports.reduce((sum, value) => sum + value, 0) / supports.length;

  if (support >= 0.66) {
    return {
      level: "supported",
      label: "More supported",
      arrow: "↑",
      explanation:
        "Training infrastructure, worker voice, and transition support make redeployment and role redesign more feasible.",
    };
  }

  if (support <= 0.34) {
    return {
      level: "constrained",
      label: "More constrained",
      arrow: "↓",
      explanation:
        "Limited training infrastructure, worker voice, and transition support make redeployment harder to sustain.",
    };
  }

  return {
    level: "mixed",
    label: "Mixed support",
    arrow: "→",
    explanation:
      "Some institutional supports for retraining and worker voice are present, but redeployment remains uneven.",
  };
}

function organizationPresetMatchScore(preset: Preset, values: Record<string, string | boolean>): number {
  return ["deployment_strategy", "retraining_commitment", "worker_participation"].reduce(
    (score, field) => score + (preset.values[field] === values[field] ? 1 : 0),
    0,
  );
}

function closestOrganizationPreset(values: Record<string, string | boolean>): Preset {
  return organizationalPresets.reduce((best, preset) =>
    organizationPresetMatchScore(preset, values) > organizationPresetMatchScore(best, values) ? preset : best,
  );
}

function normalizeDimension(control: ControlConfig, value: string): number {
  const index = Math.max(0, control.options.indexOf(value));
  if (control.options.length <= 1) return 0.5;
  return 0.25 + (index / (control.options.length - 1)) * 0.75;
}

function polarPoint(cx: number, cy: number, radius: number, angleDegrees: number) {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function wrapSvgLabel(label: string): string[] {
  if (label.includes("-")) return label.split("-").map((part, index) => index === 0 ? `${part}-` : part);
  const words = label.split(" ");
  if (words.length === 2 && label.length > 14) return words;
  if (words.length <= 2) return [label];
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function InstitutionShape({ values }: { values: Record<string, string | boolean> }) {
  const size = 520;
  const center = size / 2;
  const outerRadius = 148;
  const labelRadius = 205;
  const minRadius = 36;
  const points = institutionalControls.map((control, index) => {
    const angle = (360 / institutionalControls.length) * index;
    const normalized = normalizeDimension(control, String(values[control.field]));
    return polarPoint(center, center, minRadius + normalized * (outerRadius - minRadius), angle);
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="institution-shape-wrap">
      <svg className="institution-shape" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Institutional configuration fingerprint">
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <circle
            key={fraction}
            className="shape-ring"
            cx={center}
            cy={center}
            r={minRadius + fraction * (outerRadius - minRadius)}
          />
        ))}
        {institutionalControls.map((control, index) => {
          const angle = (360 / institutionalControls.length) * index;
          const end = polarPoint(center, center, outerRadius, angle);
          const labelPoint = polarPoint(center, center, labelRadius, angle);
          const lines = wrapSvgLabel(control.shortLabel ?? control.label);
          const anchor = labelPoint.x < center - 25 ? "end" : labelPoint.x > center + 25 ? "start" : "middle";
          return (
            <g key={control.field}>
              <line className="shape-axis" x1={center} y1={center} x2={end.x} y2={end.y} />
              <text className="shape-label" x={labelPoint.x} y={labelPoint.y} textAnchor={anchor}>
                {lines.map((line, lineIndex) => (
                  <tspan key={line} x={labelPoint.x} dy={lineIndex === 0 ? 0 : 13}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        <polygon className="shape-polygon" points={polygon} />
        {points.map((point, index) => (
          <circle
            key={institutionalControls[index].field}
            className="shape-node"
            cx={point.x}
            cy={point.y}
            r={5}
          />
        ))}
        <circle className="shape-core" cx={center} cy={center} r={11} />
      </svg>
      <p className="shape-caption">The shape shows the configuration across institutional dimensions. Larger does not mean “better”; it means a stronger or more intensive setting on that dimension.</p>
    </div>
  );
}

function MiniInstitutionShape({
  values,
  label,
}: {
  values: Record<string, string | boolean>;
  label: string;
}) {
  const size = 190;
  const center = size / 2;
  const outerRadius = 70;
  const minRadius = 18;
  const points = institutionalControls.map((control, index) => {
    const angle = (360 / institutionalControls.length) * index;
    const normalized = normalizeDimension(control, String(values[control.field]));
    return polarPoint(center, center, minRadius + normalized * (outerRadius - minRadius), angle);
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg
      className="mini-institution-shape"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${label} institutional fingerprint`}
    >
      {[0.33, 0.66, 1].map((fraction) => (
        <circle
          key={fraction}
          className="shape-ring"
          cx={center}
          cy={center}
          r={minRadius + fraction * (outerRadius - minRadius)}
        />
      ))}
      {institutionalControls.map((control, index) => {
        const angle = (360 / institutionalControls.length) * index;
        const end = polarPoint(center, center, outerRadius, angle);
        return (
          <line
            key={control.field}
            className="shape-axis"
            x1={center}
            y1={center}
            x2={end.x}
            y2={end.y}
          />
        );
      })}
      <polygon className="shape-polygon" points={polygon} />
      <circle className="shape-core" cx={center} cy={center} r={7} />
    </svg>
  );
}

function ComparativeCasesPanel({
  currentValues,
  currentLabel,
  selectedCaseId,
  onSelectCase,
}: {
  currentValues: Record<string, string | boolean>;
  currentLabel: string;
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
}) {
  const selectedCase = comparativeCases.find((item) => item.id === selectedCaseId);
  const referenceValues = selectedCase ? comparativeCaseValues(selectedCase) : null;
  const contrasts = referenceValues
    ? largestInstitutionalContrasts(currentValues, referenceValues)
    : [];

  return (
    <div className="comparative-cases-panel">
      <div className="comparative-panel-heading">
        <p className="selected-label">Comparative institutional cases</p>
        <h4>How do real institutional contexts combine these same dimensions?</h4>
      </div>

      <div className="reference-case-grid">
        {comparativeCases.map((referenceCase) => {
          const values = comparativeCaseValues(referenceCase);
          const isSelected = referenceCase.id === selectedCaseId;
          return (
            <button
              type="button"
              className={`reference-case-card${isSelected ? " selected" : ""}`}
              key={referenceCase.id}
              onClick={() => onSelectCase(isSelected ? "" : referenceCase.id)}
              aria-pressed={isSelected}
            >
              <MiniInstitutionShape values={values} label={referenceCase.country} />
              <div className="reference-case-copy">
                <strong>{referenceCase.country}</strong>
                <span>{referenceCase.descriptor}</span>
                <p>{referenceCase.summary}</p>
              </div>
              <span className="reference-compare-button">
                {isSelected ? "Comparing with my arrangement" : "Compare with my arrangement"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="case-qualification">
        Cases are stylized representations of selected institutional features, not comprehensive models of each labor market.
      </p>

      {selectedCase && referenceValues && (
        <div className="reference-comparison">
          <div className="reference-comparison-heading">
            <p className="selected-label">Reference comparison</p>
            <h4>Your arrangement and {selectedCase.country}</h4>
          </div>

          <div className="reference-shape-pair">
            <div>
              <span>Your arrangement</span>
              <strong>{currentLabel}</strong>
              <MiniInstitutionShape values={currentValues} label="Your arrangement" />
            </div>
            <div>
              <span>Reference case</span>
              <strong>{selectedCase.country}</strong>
              <MiniInstitutionShape values={referenceValues} label={selectedCase.country} />
            </div>
          </div>

          {contrasts.length > 0 && (
            <div className="reference-contrast-list">
              <p>Largest contrasts across the modeled dimensions</p>
              {contrasts.map((contrast) => (
                <div className="reference-contrast-row" key={contrast.label}>
                  <strong>{contrast.label}</strong>
                  <span>{titleCase(contrast.currentValue)}</span>
                  <span aria-hidden="true">→</span>
                  <span>{titleCase(contrast.referenceValue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}



function CausalConnector({
  label,
  pulseKey,
  showPulse = true,
}: {
  label?: string;
  pulseKey: string;
  showPulse?: boolean;
}) {
  return (
    <div className="causal-connector-wrap" aria-hidden="true">
      {label && <span className="causal-label">{label}</span>}
      <div className="causal-connector">
        {showPulse && <span key={pulseKey} />}
      </div>
    </div>
  );
}

function EvidencePanel({
  evidence,
  activeIds,
}: {
  evidence: EvidenceReference[];
  activeIds: string[];
}) {
  const active = evidence.filter((item) => activeIds.includes(item.source_id));
  return (
    <div className="evidence-list">
      {active.map((item) => (
        <article className="evidence-item" key={item.source_id}>
          <div>
            <strong>{item.source_id}</strong>
          </div>
          <p>{item.claim_summary}</p>
          <small>{item.citation}{item.page_ref ? `, p. ${item.page_ref}` : ""}</small>
        </article>
      ))}
    </div>
  );
}

function formatInstitutionLevel(value: string): string {
  if (value === "co_governed") return "Co-governed";
  if (value === "rights_based") return "Rights-based";
  return titleCase(value);
}

function InstitutionalDimensionItem({
  control,
  value,
  onChange,
}: {
  control: ControlConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  const copy = institutionalDimensionCopy[control.field];
  const index = Math.max(0, control.options.indexOf(value));

  return (
    <article className="institution-detail-item">
      <div className="institution-detail-copy">
        <h4>{control.label}</h4>
        <p>{copy.explanation}</p>
      </div>
      <div className="institution-compact-control">
        <span className="institution-current-level">{formatInstitutionLevel(value)}</span>
        <div className="institution-slider-stack">
          <input
            aria-label={control.label}
            className="institution-mini-slider"
            type="range"
            min={0}
            max={control.options.length - 1}
            step={1}
            value={index}
            onChange={(event) => onChange(control.options[Number(event.target.value)])}
          />
          <div className="institution-level-ends">
            <span>{formatInstitutionLevel(control.options[0])}</span>
            <span>{formatInstitutionLevel(control.options[control.options.length - 1])}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function InstitutionalDetails({
  values,
  onChange,
}: {
  values: Record<string, string | boolean>;
  onChange: (field: string, value: string) => void;
}) {
  const controlsByField = Object.fromEntries(institutionalControls.map((control) => [control.field, control]));

  return (
    <div className="institution-detail-panel">
      <p className="institution-detail-intro">
        These dimensions describe the rules and systems that shape how technological change is managed.
      </p>
      <div className="institution-detail-list">
        {institutionalDetailGroups.flatMap((group) => group.fields).map((field) => {
          const control = controlsByField[field];
          return (
            <InstitutionalDimensionItem
              key={field}
              control={control}
              value={String(values[field])}
              onChange={(value) => onChange(field, value)}
            />
          );
        })}
      </div>
    </div>
  );
}

function formatOrganizationValue(value: string): string {
  if (value === "pre_deployment") return "Pre-deployment";
  if (value === "post_deployment") return "Post-deployment";
  return titleCase(value);
}

function OrganizationAssumptionItem({
  control,
  value,
  onChange,
}: {
  control: ControlConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  const index = Math.max(0, control.options.indexOf(value));
  const explanation = organizationalDimensionCopy[control.field] ?? "";

  return (
    <article className="organization-assumption-item">
      <div className="organization-assumption-copy">
        <h4>{control.label}</h4>
        <p>{explanation}</p>
      </div>
      <div className="organization-compact-control">
        <span className="organization-current-level">{formatOrganizationValue(value)}</span>
        <div className="organization-slider-stack">
          <input
            aria-label={control.label}
            className="organization-mini-slider"
            type="range"
            min={0}
            max={control.options.length - 1}
            step={1}
            value={index}
            onChange={(event) => onChange(control.options[Number(event.target.value)])}
          />
          <div className="organization-level-ends">
            <span>{formatOrganizationValue(control.options[0])}</span>
            <span>{formatOrganizationValue(control.options[control.options.length - 1])}</span>
          </div>
        </div>
      </div>
    </article>
  );
}


type TensionSide = "left" | "right";

type OutcomeTensionFamily = {
  id: string;
  leftLabel: string;
  rightLabel: string;
  leftRuleIds: string[];
  rightRuleIds: string[];
};

const outcomeTensionFamilies: Record<OutcomeDimension, OutcomeTensionFamily[]> = {
  employment: [
    {
      id: "employment-oversight",
      leftLabel: "Low oversight",
      rightLabel: "Human oversight",
      leftRuleIds: [],
      rightRuleIds: ["rule_human_oversight_regulation"],
    },
    {
      id: "employment-safeguards",
      leftLabel: "Weak screening safeguards",
      rightLabel: "Data & bias safeguards",
      leftRuleIds: [],
      rightRuleIds: [
        "rule_data_protection_bias_safeguards",
        "rule_nyc_aedt_bias_audit",
      ],
    },
  ],
  wages: [
    {
      id: "wages-investment",
      leftLabel: "Short-term cost focus",
      rightLabel: "Worker investment & redesign",
      leftRuleIds: [],
      rightRuleIds: [
        "rule_employer_retraining_incentives",
        "rule_singapore_employer_incentives_wages",
      ],
    },
  ],
  mobility: [
    {
      id: "mobility-security",
      leftLabel: "Thin transition support",
      rightLabel: "Transition security",
      leftRuleIds: [],
      rightRuleIds: [
        "rule_social_protection_transition_buffer",
        "rule_denmark_flexicurity_reallocation",
      ],
    },
    {
      id: "mobility-pathways",
      leftLabel: "Fragmented pathways",
      rightLabel: "Career pathways",
      leftRuleIds: [],
      rightRuleIds: ["rule_nyc_skills_job_quality_pathways"],
    },
  ],
  productivity: [
    {
      id: "productivity-design",
      leftLabel: "Poor task fit",
      rightLabel: "Complementary task design",
      leftRuleIds: [],
      rightRuleIds: ["rule_augmentation_task_allocation_productivity"],
    },
  ],
  redeployment: [
    {
      id: "redeployment-training",
      leftLabel: "Weak retraining support",
      rightLabel: "Training & redeployment capacity",
      leftRuleIds: ["rule_weak_training_displacement_risk"],
      rightRuleIds: ["rule_strong_training_redeployment"],
    },
    {
      id: "redeployment-security",
      leftLabel: "Individual adjustment",
      rightLabel: "Transition security",
      leftRuleIds: [],
      rightRuleIds: [
        "rule_social_protection_transition_buffer",
        "rule_denmark_flexicurity_reallocation",
      ],
    },
    {
      id: "redeployment-coordination",
      leftLabel: "Fragmented coordination",
      rightLabel: "Coordinated transition",
      leftRuleIds: [],
      rightRuleIds: [
        "rule_social_dialogue_training",
        "rule_singapore_tripartite_transition",
      ],
    },
  ],
  displacement: [
    {
      id: "displacement-deployment",
      leftLabel: "Automation-first substitution",
      rightLabel: "Managed transition",
      leftRuleIds: ["rule_automation_first_high_exposure_risk"],
      rightRuleIds: [],
    },
    {
      id: "displacement-training",
      leftLabel: "Weak retraining support",
      rightLabel: "Redeployment pathways",
      leftRuleIds: ["rule_weak_training_displacement_risk"],
      rightRuleIds: [],
    },
  ],
  skill_accumulation: [
    {
      id: "skills-investment",
      leftLabel: "Skill-eroding automation",
      rightLabel: "Training & learning investment",
      leftRuleIds: ["rule_meaningful_work_agency_risk"],
      rightRuleIds: [
        "rule_strong_training_redeployment",
        "rule_social_dialogue_training",
        "rule_employer_retraining_incentives",
      ],
    },
    {
      id: "skills-redesign",
      leftLabel: "Top-down redesign",
      rightLabel: "Worker-centered redesign",
      leftRuleIds: [],
      rightRuleIds: [
        "rule_worker_centered_redesign",
        "rule_worker_consultation_ai_adoption",
      ],
    },
  ],
  job_quality: [
    {
      id: "quality-agency",
      leftLabel: "Algorithmic control",
      rightLabel: "Worker agency",
      leftRuleIds: [
        "rule_algorithmic_management_job_quality_risk",
        "rule_automation_first_high_exposure_risk",
      ],
      rightRuleIds: [
        "rule_worker_voice_job_quality",
        "rule_worker_consultation_ai_adoption",
      ],
    },
    {
      id: "quality-safeguards",
      leftLabel: "Weak safeguards",
      rightLabel: "Governance safeguards",
      leftRuleIds: [],
      rightRuleIds: [
        "rule_human_oversight_regulation",
        "rule_algorithmic_transparency_information_rights",
        "rule_data_protection_bias_safeguards",
      ],
    },
    {
      id: "quality-redesign",
      leftLabel: "Meaning-eroding automation",
      rightLabel: "Human-centered redesign",
      leftRuleIds: ["rule_meaningful_work_agency_risk"],
      rightRuleIds: [
        "rule_worker_centered_redesign",
        "rule_augmentation_task_allocation_productivity",
      ],
    },
  ],
  distribution_of_gains: [
    {
      id: "distribution-power",
      leftLabel: "Employer discretion",
      rightLabel: "Bargaining power & standards",
      leftRuleIds: [],
      rightRuleIds: [
        "rule_productive_constraints_distribution",
        "rule_worker_voice_job_quality",
      ],
    },
    {
      id: "distribution-information",
      leftLabel: "Opaque allocation",
      rightLabel: "Transparency & information rights",
      leftRuleIds: [],
      rightRuleIds: ["rule_algorithmic_transparency_information_rights"],
    },
  ],
};

function familyYPositions(count: number): number[] {
  if (count <= 1) return [50];
  if (count === 2) return [34, 66];
  return [24, 50, 76];
}

function ruleIsActive(outcome: OutcomeResult, ruleIds: string[]): boolean {
  if (!ruleIds.length) return false;
  const activeIds = new Set(outcome.ruleIds);
  return ruleIds.some((ruleId) => activeIds.has(ruleId));
}

function familyNarrative(
  outcome: OutcomeResult,
  ruleIds: string[],
): string | null {
  if (!ruleIds.length) return null;

  const activeIds = new Set(outcome.ruleIds);
  const activeRule =
    appScenarioRules.find(
      (rule) => ruleIds.includes(rule.id) && activeIds.has(rule.id),
    ) ??
    appScenarioRules.find((rule) => ruleIds.includes(rule.id));

  return activeRule?.narrative_template ?? null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothStep(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

function previewLevelForFamily({
  familyIndex,
  familyCount,
  side,
  active,
  previewDirection,
  previewProgress,
}: {
  familyIndex: number;
  familyCount: number;
  side: TensionSide;
  active: boolean;
  previewDirection: TensionSide | null;
  previewProgress: number;
}): number {
  if (!previewDirection || previewProgress <= 0) {
    return active ? 1 : 0;
  }

  if (side === previewDirection) {
    if (active) return 1;

    const segment = 1 / Math.max(1, familyCount);
    const start = Math.max(0, familyIndex * segment - segment * 0.18);
    const end = Math.min(1, start + segment * 1.18);

    return smoothStep(
      (previewProgress - start) / Math.max(0.001, end - start),
    );
  }

  if (active) {
    const segment = 1 / Math.max(1, familyCount);
    const start = Math.max(0, familyIndex * segment - segment * 0.1);
    const end = Math.min(1, start + segment * 1.08);
    const fade = smoothStep(
      (previewProgress - start) / Math.max(0.001, end - start),
    );

    return Math.max(0.12, 1 - fade * 0.88);
  }

  return 0;
}

function TensionFamilyButton({
  label,
  side,
  level,
  current,
  focused,
  onHover,
  onLeave,
  onClick,
}: {
  label: string;
  side: TensionSide;
  level: number;
  current: boolean;
  focused: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "tension-family-label",
        `is-${side}`,
        current ? "is-current" : "is-latent",
        level >= 0.5 ? "is-lit" : "",
        focused ? "is-focused" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--family-level": level.toFixed(3) } as CSSProperties}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      onClick={onClick}
    >
      <span>{label}</span>
    </button>
  );
}

function OutcomeMovement({
  outcome,
  revealIndex,
}: {
  outcome: OutcomeResult;
  revealIndex: number;
}) {
  const meta = directionMeta[outcome.dimension];
  const families = outcomeTensionFamilies[outcome.dimension];

  // Keep the evidence-derived modeled result in a central band and reserve
  // the outer field for counterfactual exploration.
  const modeledScore = Math.max(-1, Math.min(1, outcome.score));
  const modeledPosition = 50 + modeledScore * 18;

  const [previewPosition, setPreviewPosition] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoveredFamily, setHoveredFamily] = useState<{
    familyId: string;
    side: TensionSide;
  } | null>(null);
  const [lockedFamily, setLockedFamily] = useState<{
    familyId: string;
    side: TensionSide;
  } | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);

  const displayPosition = previewPosition ?? modeledPosition;
  const previewDirection: TensionSide | null =
    previewPosition === null
      ? null
      : previewPosition > modeledPosition + 1
        ? "right"
        : previewPosition < modeledPosition - 1
          ? "left"
          : null;

  const previewProgress =
    previewDirection === "right"
      ? clamp01(
          (displayPosition - modeledPosition) /
            Math.max(1, 92 - modeledPosition),
        )
      : previewDirection === "left"
        ? clamp01(
            (modeledPosition - displayPosition) /
              Math.max(1, modeledPosition - 8),
          )
        : 0;

  const activeFocus = hoveredFamily ?? lockedFamily;

  const hoverTug =
    previewPosition === null && activeFocus
      ? activeFocus.side === "right"
        ? 7
        : -7
      : 0;

  const yPositions = familyYPositions(families.length);

  function positionFromClientX(clientX: number): number {
    const stage = stageRef.current;
    if (!stage) return modeledPosition;

    const rect = stage.getBoundingClientRect();
    const ratio = clamp01((clientX - rect.left) / Math.max(1, rect.width));

    return Math.max(8, Math.min(92, ratio * 100));
  }

  function startDragging(event: React.PointerEvent<HTMLButtonElement>) {
    setLockedFamily(null);
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function continueDragging(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    setPreviewPosition(positionFromClientX(event.clientX));
  }

  function stopDragging(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    setDragging(false);

    if (
      previewPosition !== null &&
      Math.abs(previewPosition - modeledPosition) < 1.5
    ) {
      setPreviewPosition(null);
    }
  }

  function resetPreview() {
    setPreviewPosition(null);
    setLockedFamily(null);
  }

  function familyCurrent(
    family: OutcomeTensionFamily,
    side: TensionSide,
  ): boolean {
    return ruleIsActive(
      outcome,
      side === "left" ? family.leftRuleIds : family.rightRuleIds,
    );
  }

  function familyLevel(
    family: OutcomeTensionFamily,
    side: TensionSide,
    familyIndex: number,
  ): number {
    return previewLevelForFamily({
      familyIndex,
      familyCount: families.length,
      side,
      active: familyCurrent(family, side),
      previewDirection,
      previewProgress,
    });
  }

  function targetPositionForFamily(
    familyIndex: number,
    side: TensionSide,
  ): number {
    const fraction = Math.min(
      0.94,
      (familyIndex + 0.8) / Math.max(1, families.length),
    );

    return side === "right"
      ? modeledPosition + fraction * (92 - modeledPosition)
      : modeledPosition - fraction * (modeledPosition - 8);
  }

  function handleFamilyClick(
    family: OutcomeTensionFamily,
    familyIndex: number,
    side: TensionSide,
  ) {
    const next = { familyId: family.id, side };

    setLockedFamily((current) =>
      current?.familyId === family.id && current.side === side ? null : next,
    );

    if (!familyCurrent(family, side)) {
      setPreviewPosition(targetPositionForFamily(familyIndex, side));
    }
  }

  const previewActive =
    previewPosition !== null &&
    Math.abs(displayPosition - modeledPosition) >= 1.5;

  const lockedDefinition = lockedFamily
    ? families.find((family) => family.id === lockedFamily.familyId)
    : null;

  const lockedRuleIds =
    lockedDefinition && lockedFamily
      ? lockedFamily.side === "left"
        ? lockedDefinition.leftRuleIds
        : lockedDefinition.rightRuleIds
      : [];

  const lockedNarrative =
    lockedFamily && lockedDefinition
      ? familyNarrative(outcome, lockedRuleIds)
      : null;

  return (
    <article
      className={`outcome-movement ${
        previewActive ? "has-preview" : ""
      } ${dragging ? "is-dragging" : ""}`}
      style={{ "--outcome-index": revealIndex } as CSSProperties}
    >
      <div className="outcome-heading">
        <h3>{formatOutcomeLabel(outcome.dimension)}</h3>
      </div>

      <div
        className={`outcome-tension-system ${
          previewDirection ? `preview-${previewDirection}` : ""
        }`}
      >
        <div
          className="tension-family-bank is-left"
          style={
            {
              "--family-count": families.length,
            } as CSSProperties
          }
        >
          {families.map((family, index) => {
            const level = familyLevel(family, "left", index);
            const focused =
              activeFocus?.familyId === family.id &&
              activeFocus.side === "left";

            return (
              <TensionFamilyButton
                key={`${family.id}-left`}
                label={family.leftLabel}
                side="left"
                level={level}
                current={familyCurrent(family, "left")}
                focused={focused}
                onHover={() =>
                  setHoveredFamily({ familyId: family.id, side: "left" })
                }
                onLeave={() => setHoveredFamily(null)}
                onClick={() => handleFamilyClick(family, index, "left")}
              />
            );
          })}
        </div>

        <div className="outcome-tension-stage" ref={stageRef}>
          <svg
            className="outcome-tension-cables"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {families.map((family, index) => {
              const y = yPositions[index];
              const leftLevel = familyLevel(family, "left", index);
              const rightLevel = familyLevel(family, "right", index);
              const nodeX = displayPosition;

              const leftPath = `M 2 ${y} C 28 ${y}, ${Math.max(
                8,
                nodeX - 16,
              )} 50, ${nodeX} 50`;

              const rightPath = `M ${nodeX} 50 C ${Math.min(
                92,
                nodeX + 16,
              )} 50, 72 ${y}, 98 ${y}`;

              return (
                <g key={family.id}>
                  <path
                    className="tension-cable-base"
                    d={leftPath}
                  />
                  <path
                    className="tension-cable-live"
                    d={leftPath}
                    style={{ "--cable-level": leftLevel } as CSSProperties}
                  />
                  <circle
                    className="tension-endpoint-base"
                    cx="2"
                    cy={y}
                    r="2.25"
                  />
                  <circle
                    className="tension-endpoint-live"
                    cx="2"
                    cy={y}
                    r={1.15 + leftLevel * 1.15}
                    style={{ "--endpoint-level": leftLevel } as CSSProperties}
                  />

                  <path
                    className="tension-cable-base"
                    d={rightPath}
                  />
                  <path
                    className="tension-cable-live"
                    d={rightPath}
                    style={{ "--cable-level": rightLevel } as CSSProperties}
                  />
                  <circle
                    className="tension-endpoint-base"
                    cx="98"
                    cy={y}
                    r="2.25"
                  />
                  <circle
                    className="tension-endpoint-live"
                    cx="98"
                    cy={y}
                    r={1.15 + rightLevel * 1.15}
                    style={{ "--endpoint-level": rightLevel } as CSSProperties}
                  />
                </g>
              );
            })}
          </svg>

          <div className="outcome-balance-axis" aria-hidden="true">
            <span className="outcome-balance-midpoint" />
          </div>

          {previewActive && (
            <>
              <button
                type="button"
                className="outcome-modeled-anchor"
                style={
                  {
                    "--modeled-position": `${modeledPosition}%`,
                  } as CSSProperties
                }
                aria-label="Return to the modeled scenario position"
                onClick={resetPreview}
              >
                <span />
              </button>

              <span
                className="outcome-preview-trace"
                style={
                  {
                    "--trace-start": `${Math.min(
                      modeledPosition,
                      displayPosition,
                    )}%`,
                    "--trace-width": `${Math.abs(
                      displayPosition - modeledPosition,
                    )}%`,
                  } as CSSProperties
                }
                aria-hidden="true"
              />
            </>
          )}

          <button
            type="button"
            className={`outcome-balance-node ${
              previewActive ? "is-preview" : ""
            } ${dragging ? "is-dragging" : ""}`}
            style={
              {
                "--balance-position": `${displayPosition}%`,
                "--balance-tug": `${hoverTug}px`,
              } as CSSProperties
            }
            aria-label="Drag horizontally to explore how the balance could shift"
            onPointerDown={startDragging}
            onPointerMove={continueDragging}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onDoubleClick={resetPreview}
          >
            <span className="balance-node-orbit" aria-hidden="true" />
            <span className="balance-node-core" />
          </button>
        </div>

        <div
          className="tension-family-bank is-right"
          style={
            {
              "--family-count": families.length,
            } as CSSProperties
          }
        >
          {families.map((family, index) => {
            const level = familyLevel(family, "right", index);
            const focused =
              activeFocus?.familyId === family.id &&
              activeFocus.side === "right";

            return (
              <TensionFamilyButton
                key={`${family.id}-right`}
                label={family.rightLabel}
                side="right"
                level={level}
                current={familyCurrent(family, "right")}
                focused={focused}
                onHover={() =>
                  setHoveredFamily({ familyId: family.id, side: "right" })
                }
                onLeave={() => setHoveredFamily(null)}
                onClick={() => handleFamilyClick(family, index, "right")}
              />
            );
          })}
        </div>
      </div>
    </article>
  );
}

function OutcomesExplorer({
  result,
}: {
  result: ScenarioResult;
}) {
  return (
    <div className="outcomes-list">
      {result.outcomes.map((outcome, index) => (
        <OutcomeMovement
          key={outcome.dimension}
          outcome={outcome}
          revealIndex={index}
        />
      ))}
    </div>
  );
}


function OrganizationDecisionIcon({ field, size = 18 }: { field: string; size?: number }) {
  if (field === "deployment_strategy") {
    return <Workflow size={size} strokeWidth={1.8} aria-hidden="true" />;
  }

  if (field === "retraining_commitment") {
    return <GraduationCap size={size} strokeWidth={1.8} aria-hidden="true" />;
  }

  return <UsersRound size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function OrganizationDecisionTrack({
  control,
  value,
  occupation,
  revealIndex,
  onChange,
}: {
  control: ControlConfig;
  value: string;
  occupation: OccupationProfile;
  revealIndex: number;
  onChange: (value: string) => void;
}) {
  const index = Math.max(0, control.options.indexOf(value));
  const explanation = organizationDecisionCopy(occupation, control.field, value);

  return (
    <article
      className="organization-decision-track"
      style={{ "--decision-index": revealIndex } as CSSProperties}
    >
      <div className="organization-decision-copy">
        <div className="decision-title-row">
          <strong>{control.label}</strong>
          <span>{titleCase(value)}</span>
        </div>
        <p className="decision-explanation" key={`${control.field}-${value}`}>
          {explanation}
        </p>
      </div>
      <div className="decision-track-control">
        <div
          className="decision-slider-shell"
          style={
            {
              "--decision-progress": `${control.options.length > 1 ? (index / (control.options.length - 1)) * 100 : 0}%`,
            } as CSSProperties
          }
        >
          <input
            aria-label={control.label}
            className="decision-slider"
            type="range"
            min={0}
            max={control.options.length - 1}
            step={1}
            value={index}
            onChange={(event) => onChange(control.options[Number(event.target.value)])}
          />
          <span className="decision-slider-marker" aria-hidden="true">
            <OrganizationDecisionIcon field={control.field} />
          </span>
        </div>
        <div className="decision-track-labels">
          <span>{titleCase(control.options[0])}</span>
          <span>{titleCase(control.options[control.options.length - 1])}</span>
        </div>
      </div>
    </article>
  );
}

function TaskModeIcon({ lane }: { lane: WorkLane }) {
  if (lane === "human") {
    return (
      <svg viewBox="0 0 34 34" className="task-mode-icon human-icon" aria-hidden="true">
        <circle cx="17" cy="17" r="13" />
        <circle className="icon-fill" cx="12.5" cy="14" r="1.4" />
        <circle className="icon-fill" cx="21.5" cy="14" r="1.4" />
        <path d="M11.5 20c1.8 2.3 3.7 3.4 5.7 3.4 2 0 3.8-1.1 5.4-3.4" />
      </svg>
    );
  }

  if (lane === "ai") {
    return (
      <svg viewBox="0 0 34 34" className="task-mode-icon ai-icon" aria-hidden="true">
        <rect x="5" y="7" width="24" height="22" rx="6" />
        <path d="M17 7V3.8M14.5 3.8h5" />
        <circle className="icon-fill" cx="12.5" cy="16" r="1.5" />
        <circle className="icon-fill" cx="21.5" cy="16" r="1.5" />
        <path d="M12 22h10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 40 34" className="task-mode-icon shared-icon" aria-hidden="true">
      <circle cx="14" cy="17" r="10" />
      <rect x="17" y="7" width="17" height="20" rx="5" />
      <circle className="icon-fill" cx="11.5" cy="14" r="1.2" />
      <path d="M10 20c1.3 1.5 2.7 2.2 4.2 2.2" />
      <circle className="icon-fill" cx="23" cy="15" r="1.2" />
      <circle className="icon-fill" cx="29" cy="15" r="1.2" />
      <path d="M23 21h6" />
    </svg>
  );
}

const laneMeta: Record<WorkLane, { label: string; description: string }> = {
  human: {
    label: "Human-led",
    description: "People retain primary responsibility for the task.",
  },
  shared: {
    label: "Human + AI",
    description: "People and AI divide or iterate on the task together.",
  },
  ai: {
    label: "AI-led",
    description: "AI takes the first or primary execution role, with human involvement where needed.",
  },
};

function WorkDesignStudio({
  workDesign,
  organizationLabel,
  assignments,
  customTaskLanes,
  onMoveTask,
  onReset,
}: {
  workDesign: WorkDesign;
  organizationLabel: string;
  assignments: TaskAssignment[];
  customTaskLanes: Record<string, WorkLane>;
  onMoveTask: (taskId: string, lane: WorkLane) => void;
  onReset: () => void;
}) {
  const customized = Object.keys(customTaskLanes).length > 0;
  const lanes: WorkLane[] = ["human", "shared", "ai"];
  const resolved = assignments.map((assignment) => ({
    ...assignment,
    lane: customTaskLanes[assignment.task.id] ?? assignment.lane,
  }));

  return (
    <div className="work-design-studio">
      <div className="scenario-pattern">
        <div>
          <span>Scenario-derived work design</span>
          <strong>{workDesign.label}</strong>
          <small>Generated from: {organizationLabel}</small>
        </div>
        <p>{workDesign.summary}</p>
      </div>

      <div className="studio-intro-row">
        <p>
          The starting arrangement uses tasks commonly associated with this occupation and the selected scenario to imagine
          how work could be divided. It is a work-design prompt, not a prediction or estimated task share.
        </p>
        <button type="button" className="text-button reset-studio" onClick={onReset} disabled={!customized}>
          Reset to scenario
        </button>
      </div>

      <div className="studio-instruction" role="note">
        <MoveHorizontal size={17} aria-hidden="true" />
        <span>Drag tasks horizontally between Human-led, Human + AI, and AI-led to explore different ways this work could be organized.</span>
      </div>

      <div className="work-spectrum" aria-label="Interactive work design studio">
        <div className="work-spectrum-head">
          {lanes.map((lane) => (
            <div className={`work-spectrum-heading ${lane}`} key={lane}>
              <TaskModeIcon lane={lane} />
              <div>
                <h3>{laneMeta[lane].label}</h3>
                <p>{laneMeta[lane].description}</p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="work-spectrum-board"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const taskId = event.dataTransfer.getData("text/plain");
            if (!taskId) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const position = (event.clientX - rect.left) / rect.width;
            const lane: WorkLane = position < 0.33 ? "human" : position < 0.66 ? "shared" : "ai";
            onMoveTask(taskId, lane);
          }}
        >
          <span className="lane-guide guide-human" />
          <span className="lane-guide guide-shared" />
          <span className="lane-guide guide-ai" />
          {resolved.map((assignment) => {
            const laneIndex = lanes.indexOf(assignment.lane);
            return (
              <div className="task-flow-row" key={assignment.task.id}>
                <span className="task-flow-baseline" />
                <button
                  type="button"
                  draggable
                  className={`task-token lane-${assignment.lane}`}
                  style={{ "--lane-index": laneIndex } as CSSProperties}
                  title={`${assignment.task.text}\n\n${assignment.rationale}`}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", assignment.task.id);
                  }}
                  onClick={() => {
                    onMoveTask(assignment.task.id, lanes[(laneIndex + 1) % lanes.length]);
                  }}
                >
                  <TaskModeIcon lane={assignment.lane} />
                  <span>{compactTaskText(assignment.task.text, 9)}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {customized && (
        <div className="studio-mode-note custom">
          <strong>You are exploring your own work-design imaginary.</strong>
          <span>
            The outcome movements below still reflect the model-supported institutional and organizational scenario; your
            manual task arrangement is kept separate from those outputs.
          </span>
        </div>
      )}
    </div>
  );
}

function movementShort(outcome?: OutcomeResult): string {
  if (!outcome) return "No directional rule";
  const meta = directionMeta[outcome.dimension];
  if (outcome.score > 0.2) return `→ ${meta.right}`;
  if (outcome.score < -0.2) return `← ${meta.left}`;
  return "↔ mixed / contextual";
}

function ComparePanel({
  snapshot,
  currentInstitutionLabel,
  currentOrganizationLabel,
  currentWorkDesign,
  currentResult,
  onClear,
}: {
  snapshot: ComparisonSnapshot;
  currentInstitutionLabel: string;
  currentOrganizationLabel: string;
  currentWorkDesign: WorkDesign;
  currentResult: ScenarioResult;
  onClear: () => void;
}) {
  const dimensions = Array.from(
    new Set([
      ...snapshot.result.outcomes.map((outcome) => outcome.dimension),
      ...currentResult.outcomes.map((outcome) => outcome.dimension),
    ]),
  );

  return (
    <section className="compare-panel" id="compare">
      <div className="section-kicker">Compare another future</div>
      <div className="compare-title-row">
        <div>
          <h2>Same technological exposure. Different pathways.</h2>
          <p>
            {snapshot.occupationTitle} · AI exposure {titleCase(snapshot.exposureLevel)} · held constant
          </p>
        </div>
        <button type="button" className="text-button" onClick={onClear}>Clear comparison</button>
      </div>

      <div className="compare-grid compare-head">
        <div />
        <div>
          <span>Future A</span>
          <strong>{snapshot.institutionLabel}</strong>
          <p>{snapshot.organizationLabel}</p>
        </div>
        <div>
          <span>Future B</span>
          <strong>{currentInstitutionLabel}</strong>
          <p>{currentOrganizationLabel}</p>
        </div>
      </div>

      <div className="compare-grid compare-work">
        <strong>Work design</strong>
        <div>
          <span>{snapshot.workDesign.label}</span>
          <p>{snapshot.workDesign.summary}</p>
        </div>
        <div>
          <span>{currentWorkDesign.label}</span>
          <p>{currentWorkDesign.summary}</p>
        </div>
      </div>

      {dimensions.map((dimension) => {
        const a = snapshot.result.outcomes.find((outcome) => outcome.dimension === dimension);
        const b = currentResult.outcomes.find((outcome) => outcome.dimension === dimension);
        return (
          <div className="compare-grid compare-outcome" key={dimension}>
            <strong>{formatOutcomeLabel(dimension)}</strong>
            <span>{movementShort(a)}</span>
            <span>{movementShort(b)}</span>
          </div>
        );
      })}
    </section>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<"explorer" | "framework">("explorer");
  const returnToExplorerTop = useRef(false);
  useLayoutEffect(() => {
    if (activeTab !== "explorer" || !returnToExplorerTop.current) return;
    returnToExplorerTop.current = false;
    document.getElementById("explorer-tab")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeTab]);
  const defaultOccupation = findOccupation("Customer Service Representatives");
  const [occupationCode, setOccupationCode] = useState(defaultOccupation.onet_soc_code);
  const [query, setQuery] = useState("");
  const [institutionPresetId, setInstitutionPresetId] = useState("publicly_coordinated");
  const [organizationPresetId, setOrganizationPresetId] = useState("augmentation_redeployment");
  const [institutionalOverrides, setInstitutionalOverrides] = useState<Record<string, string>>({});
  const [organizationalOverrides, setOrganizationalOverrides] = useState<Record<string, string | boolean>>({});
  const [geography] = useState("general");
  const [showInstitutionDetails, setShowInstitutionDetails] = useState(false);
  const [showComparativeCases, setShowComparativeCases] = useState(false);
  const [referenceCaseId, setReferenceCaseId] = useState("");
  const [showOrganizationDetails, setShowOrganizationDetails] = useState(false);
  const [organizationInView, setOrganizationInView] = useState(false);
  const organizationSectionRef = useRef<HTMLElement | null>(null);
  const [comparison, setComparison] = useState<ComparisonSnapshot | null>(null);
  const [customTaskLanes, setCustomTaskLanes] = useState<Record<string, WorkLane>>({});
  const [expandedSearchSections, setExpandedSearchSections] = useState<Record<string, boolean>>({});
  const [showOccupationBrowser, setShowOccupationBrowser] = useState(false);
  const [browseFamilyCode, setBrowseFamilyCode] = useState("");
  const [showOccupationDetail, setShowOccupationDetail] = useState(false);

  const occupation = appOccupations.find((item) => item.onet_soc_code === occupationCode) ?? defaultOccupation;
  const institutionPreset =
    institutionalPresets.find((preset) => preset.id === institutionPresetId) ?? institutionalPresets[1];
  const organizationPreset =
    organizationalPresets.find((preset) => preset.id === organizationPresetId) ?? organizationalPresets[2];

  const institutionalValues = { ...institutionPreset.values, ...institutionalOverrides };
  const organizationalValues = { ...organizationPreset.values, ...organizationalOverrides };

  const result = evaluateScenario(
    buildContext(occupation, geography, institutionalValues, organizationalValues),
    appScenarioRules,
  );
  const workDesign = deriveWorkDesign(institutionalValues, organizationalValues);
  const activeEvidence = appEvidenceReferences.filter((item) => result.evidenceIds.includes(item.source_id));
  const institutionLabel = getPresetLabel(institutionPreset, institutionalOverrides);
  const organizationLabel = getPresetLabel(organizationPreset, organizationalOverrides);
  const closestOrganizationResponse = closestOrganizationPreset(organizationalValues);
  const scenarioTaskAssignments = buildScenarioTaskAssignments(occupation, institutionalValues, organizationalValues);
  const currentComparisonSignature = buildComparisonSignature(
    occupation,
    geography,
    institutionalValues,
    organizationalValues,
  );
  const comparisonReady = Boolean(comparison && comparison.comparisonSignature !== currentComparisonSignature);
  const scenarioSignature = [
    occupation.onet_soc_code,
    institutionPresetId,
    organizationPresetId,
    geography,
    JSON.stringify(institutionalOverrides),
    JSON.stringify(organizationalOverrides),
  ].join("|");

  useEffect(() => {
    setCustomTaskLanes({});
  }, [scenarioSignature]);

  useEffect(() => {
    setExpandedSearchSections({});
  }, [query]);

  useEffect(() => {
    const section = organizationSectionRef.current;
    if (!section || organizationInView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setOrganizationInView(true);
        observer.disconnect();
      },
      {
        threshold: 0.22,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [organizationInView]);

  const occupationSearch = useMemo(() => {
    const normalized = normalizeSearchValue(query);
    if (!normalized) {
      return { mode: "occupation" as const, matches: [] as OccupationSearchMatch[] };
    }

    const directMatches: Array<OccupationSearchMatch & { sourceIndex: number }> = [];
    const aliasMatches: Array<OccupationSearchMatch & { sourceIndex: number }> = [];

    appOccupations.forEach((item, sourceIndex) => {
      const directTier = directOccupationMatchTier(item, normalized);
      if (directTier !== null) {
        directMatches.push({ item, tier: directTier, matchType: "occupation", sourceIndex });
        return;
      }

      const aliasMatch = bestAliasMatch(item, normalized);
      if (aliasMatch) {
        aliasMatches.push({
          item,
          tier: aliasMatch.tier,
          matchType: "job_title",
          matchedAlias: aliasMatch.alias,
          sourceIndex,
        });
      }
    });

    const sortMatches = (a: OccupationSearchMatch & { sourceIndex: number }, b: OccupationSearchMatch & { sourceIndex: number }) =>
      a.tier - b.tier ||
      (a.matchType === "job_title" ? (a.matchedAlias ?? "") : occupationDisplayTitle(a.item)).localeCompare(
        b.matchType === "job_title" ? (b.matchedAlias ?? "") : occupationDisplayTitle(b.item),
      ) ||
      a.sourceIndex - b.sourceIndex;

    directMatches.sort(sortMatches);
    aliasMatches.sort(sortMatches);

    if (directMatches.length > 0) {
      return { mode: "occupation" as const, matches: directMatches };
    }

    return { mode: "job_title" as const, matches: aliasMatches };
  }, [query]);

  const groupedSearchResults = query.trim().length > 0 && occupationSearch.matches.length > 8;
  const searchResults = query.trim()
    ? groupedSearchResults
      ? occupationSearch.matches
      : occupationSearch.matches.slice(0, 8)
    : [];
  const searchResultSections = buildSearchResultSections(searchResults);
  const occupationFamilies = useMemo(() => buildOccupationFamilies(appOccupations), []);
  const activeBrowseFamily =
    occupationFamilies.find((family) => family.code === browseFamilyCode) ?? null;
  const browseSubfamilies = activeBrowseFamily
    ? buildOccupationSubfamilies(activeBrowseFamily)
    : [];

  function selectOccupation(nextOccupation: OccupationProfile) {
    setOccupationCode(nextOccupation.onet_soc_code);
    setQuery("");
    setComparison(null);
    setShowOccupationBrowser(false);
    setBrowseFamilyCode("");
    setExpandedSearchSections({});
  }

  function selectInstitutionPreset(preset: Preset) {
    setInstitutionPresetId(preset.id);
    setInstitutionalOverrides({});
  }

  function updateInstitutionalOverride(field: string, value: string) {
    setInstitutionalOverrides((current) => ({ ...current, [field]: value }));
  }

  function selectOrganizationPreset(preset: Preset) {
    setOrganizationPresetId(preset.id);
    setOrganizationalOverrides({});
  }

  function moveWorkTask(taskId: string, lane: WorkLane) {
    const scenarioLane = scenarioTaskAssignments.find((assignment) => assignment.task.id === taskId)?.lane;
    setCustomTaskLanes((current) => {
      const next = { ...current };
      if (scenarioLane === lane) {
        delete next[taskId];
      } else {
        next[taskId] = lane;
      }
      return next;
    });
  }

  function saveComparison() {
    setComparison({
      occupationCode: occupation.onet_soc_code,
      occupationTitle: occupationDisplayTitle(occupation),
      exposureLevel: occupation.exposure_baseline.combined_level ?? "unknown",
      exposureScore: occupation.exposure_baseline.combined_score ?? null,
      comparisonSignature: currentComparisonSignature,
      institutionLabel,
      organizationLabel,
      workDesign,
      result,
    });
  }

  return (
    <main className="app-shell">
      <nav className="app-tabs" role="tablist" aria-label="Project sections" onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const nextTab = event.key === "Home"
          ? "explorer"
          : event.key === "End"
            ? "framework"
            : activeTab === "explorer" ? "framework" : "explorer";
        setActiveTab(nextTab);
        document.getElementById(`${nextTab}-tab`)?.focus();
      }}>
        <button
          id="explorer-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "explorer"}
          aria-controls="explorer-panel"
          tabIndex={activeTab === "explorer" ? 0 : -1}
          onClick={() => setActiveTab("explorer")}
        >
          Scenario Explorer
        </button>
        <button
          id="framework-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "framework"}
          aria-controls="framework-panel"
          tabIndex={activeTab === "framework" ? 0 : -1}
          onClick={() => setActiveTab("framework")}
        >
          About the Framework
        </button>
      </nav>
      <div id="explorer-panel" role="tabpanel" aria-labelledby="explorer-tab" tabIndex={0} hidden={activeTab !== "explorer"}>
      <header className="hero">
        <p className="eyebrow">Institutional Scenario Explorer for AI & Labor Futures</p>
        <h1>
          <span className="hero-line">Same AI exposure.</span>
          <span className="hero-line">Different institutional arrangements.</span>
          <span className="hero-line">Different labor futures.</span>
        </h1>
        <p className="hero-copy">
          Choose an occupation, hold its AI exposure as the baseline, and explore how institutional arrangements
          and organizational choices reshape the pathway from technology to work.
        </p>
      </header>

      <section className="baseline-section stage-section">
        <div className="baseline-grid">
          <div className="occupation-picker">
            <div className="section-kicker">
              <BriefcaseBusiness size={17} />
              Choose an occupation
            </div>
            <label className="search-box" htmlFor="occupation-search">
              <Search size={16} />
              <input
                id="occupation-search"
                value={query}
                placeholder="Search occupations"
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (event.target.value.trim()) {
                    setShowOccupationBrowser(false);
                    setBrowseFamilyCode("");
                  }
                }}
              />
            </label>

            {query.trim() && (
              <div className="search-results" aria-label="Occupation search results">
                <div className="search-match-type">
                  {groupedSearchResults
                    ? "Matching occupation groups"
                    : occupationSearch.mode === "occupation"
                      ? "Occupation matches"
                      : "Job title matches"}
                </div>

                {groupedSearchResults && (
                  <p className="search-broad-help">
                    Choose a job group to see matching occupations.
                  </p>
                )}

                {searchResultSections.map((section, sectionIndex) => {
                  const sectionKey =
                    `${section.familyCode ?? "results"}-${section.subfamilyCode ?? sectionIndex}`;
                  const expanded = Boolean(expandedSearchSections[sectionKey]);

                  return (
                    <div key={sectionKey} className="search-result-section">
                      {section.heading && groupedSearchResults ? (
                        <>
                          <button
                            type="button"
                            className="search-result-heading"
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedSearchSections((current) => ({
                                ...current,
                                [sectionKey]: !expanded,
                              }))
                            }
                          >
                            <span className="search-result-heading-label">
                              <span className="search-result-chevron" aria-hidden="true">
                                {expanded ? "⌄" : "›"}
                              </span>
                              <span>{section.heading}</span>
                            </span>
                            <span>{section.items.length}</span>
                          </button>

                          {expanded && (
                            <div className="search-group-items">
                              {section.items.map((match) => (
                                <button
                                  key={match.item.onet_soc_code}
                                  className="search-result-button"
                                  type="button"
                                  onClick={() => selectOccupation(match.item)}
                                >
                                  {match.matchType === "job_title" ? (
                                    <>
                                      <span>{match.matchedAlias}</span>
                                      <span className="occupation-category">
                                        Occupation category: {occupationDisplayTitle(match.item)}
                                      </span>
                                    </>
                                  ) : (
                                    <span>{occupationDisplayTitle(match.item)}</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        section.items.map((match) => (
                          <button
                            key={match.item.onet_soc_code}
                            className="search-result-button"
                            type="button"
                            onClick={() => selectOccupation(match.item)}
                          >
                            {match.matchType === "job_title" ? (
                              <>
                                <span>{match.matchedAlias}</span>
                                <span className="occupation-category">
                                  Occupation category: {occupationDisplayTitle(match.item)}
                                </span>
                              </>
                            ) : (
                              <span>{occupationDisplayTitle(match.item)}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  );
                })}
                {searchResults.length === 0 && <p>No matching occupations.</p>}
              </div>
            )}

            <div className="occupation-picker-actions">
              <button
                type="button"
                className="browse-occupations-toggle"
                aria-expanded={showOccupationBrowser}
                aria-label="Browse occupations by job family"
                onClick={() => {
                  setQuery("");
                  setShowOccupationBrowser((current) => !current);
                  if (showOccupationBrowser) setBrowseFamilyCode("");
                }}
              >
                <Layers3 size={16} />
                <span>{showOccupationBrowser ? "Hide job families" : "Browse by job family"}</span>
                <span aria-hidden="true">→</span>
              </button>

              {showOccupationBrowser && (
                <div className="occupation-browser">
                  {activeBrowseFamily ? (
                    <>
                      <div className="occupation-browser-header">
                        <button type="button" onClick={() => setBrowseFamilyCode("")}>
                          ← All job families
                        </button>
                        <div>
                          <span>Job family</span>
                          <strong>{activeBrowseFamily.label}</strong>
                        </div>
                      </div>

                      <div className="occupation-subfamily-list">
                        {browseSubfamilies.map((subfamily) => (
                          <details key={subfamily.code} className="occupation-subfamily">
                            <summary>
                              <span>{subfamily.label}</span>
                              <small>{subfamily.items.length}</small>
                            </summary>
                            <div className="occupation-subfamily-items">
                              {subfamily.items.map((item) => (
                                <button
                                  type="button"
                                  key={item.onet_soc_code}
                                  onClick={() => selectOccupation(item)}
                                >
                                  {occupationDisplayTitle(item)}
                                </button>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="occupation-browser-intro">
                        Choose a broad job family, then narrow to an occupation.
                      </p>
                      <div className="occupation-family-grid">
                        {occupationFamilies.map((family) => (
                          <button
                            type="button"
                            key={family.code}
                            onClick={() => setBrowseFamilyCode(family.code)}
                          >
                            <strong>{family.label}</strong>
                            <span>{family.items.length} occupations</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <button
                type="button"
                className="occupation-detail-toggle"
                aria-expanded={showOccupationDetail}
                onClick={() => setShowOccupationDetail((current) => !current)}
              >
                <BookOpen size={16} />
                <span>{showOccupationDetail ? "Hide occupation detail" : "Occupation detail"}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>

          </div>

          <div className="baseline-lock">
            <div className="lock-line">
              <Lock size={18} />
              <span>Held constant in this scenario</span>
            </div>
            <h2>{occupationDisplayTitle(occupation)}</h2>
            <div className="exposure-line">
              <Gauge size={18} />
              <span>AI exposure</span>
              <strong>{titleCase(occupation.exposure_baseline.combined_level ?? "unknown")}</strong>
            </div>
            <p>
              Exposure score: {occupation.exposure_baseline.combined_score ?? "n/a"} on a 0–1 scale.
              Exposure indicates where current AI capabilities overlap with occupational work; it is not a forecast of job loss.
            </p>
          </div>
        </div>

        {showOccupationDetail && (
          <div className="occupation-detail-panel">
            <div className="occupation-detail-grid">
              <div>
                <h3>Top tasks</h3>
                <ul>
                  {occupation.tasks.slice(0, 5).map((task) => <li key={task.id}>{task.text}</li>)}
                </ul>
              </div>
              <div>
                <h3>Preparation</h3>
                <p>{preparationLabel(occupation)}</p>
                <div className="chip-row">
                  {[...occupation.skills.essential, ...occupation.skills.transferable].slice(0, 8).map((skill) => (
                    <span className="chip" key={`${skill.type}-${skill.id}`}>{skill.name}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <CausalConnector
        label="AI exposure sets the baseline. Institutional arrangements shape what happens next"
        pulseKey={`baseline-to-institution-${occupation.onet_soc_code}`}
        showPulse={false}
      />

      <section className="stage-section institution-section">
        <div className="stage-number">1</div>
        <div className="stage-heading">
          <p className="eyebrow">Institutional environment</p>
          <h2>How could institutional arrangements shape what happens next?</h2>
          <p>Choose an institutional arrangement to explore how different systems manage technological change.</p>
        </div>

        <div className="preset-rail" aria-label="Institutional starting configurations">
          {institutionalPresets.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={preset.id === institutionPresetId ? "selected" : ""}
              onClick={() => selectInstitutionPreset(preset)}
            >
              <strong>{preset.label}</strong>
              <span>{preset.summary}</span>
            </button>
          ))}
        </div>

        <div className="institution-visual-grid">
          <div>
            <p className="selected-label">Current arrangement</p>
            <h3>{institutionLabel}</h3>
          </div>
          <InstitutionShape values={institutionalValues} />
        </div>

        <button
          type="button"
          className="expand-button"
          onClick={() => setShowInstitutionDetails((current) => !current)}
          aria-expanded={showInstitutionDetails}
        >
          <SlidersHorizontal size={17} />
          {showInstitutionDetails ? "Hide arrangement dimensions" : "See what this arrangement contains"}
        </button>

        {showInstitutionDetails && (
          <InstitutionalDetails values={institutionalValues} onChange={updateInstitutionalOverride} />
        )}

        <div className="comparative-cases-disclosure">
          <button
            type="button"
            className="comparative-cases-toggle"
            onClick={() => setShowComparativeCases((current) => !current)}
            aria-expanded={showComparativeCases}
          >
            <BookOpen size={16} />
            <span>{showComparativeCases ? "Hide comparative cases" : "Explore comparative cases"}</span>
            <span aria-hidden="true">→</span>
          </button>

          {showComparativeCases && (
            <ComparativeCasesPanel
              currentValues={institutionalValues}
              currentLabel={institutionLabel}
              selectedCaseId={referenceCaseId}
              onSelectCase={setReferenceCaseId}
            />
          )}
        </div>
      </section>

      <CausalConnector
        label="Institutional conditions shape what is feasible, costly, protected, or negotiable"
        pulseKey={`institution-to-organization-${scenarioSignature}`}
      />

      <section ref={organizationSectionRef} className="stage-section organization-section">
        <div className="stage-number">2</div>
        <div className="stage-heading">
          <p className="eyebrow">Organizational response</p>
          <h2>What does the employer choose to do inside that environment?</h2>
          <p>Choose how the employer deploys AI, invests in workers, and shares decisions.</p>
        </div>

        <div className="response-meter" aria-label="Organizational response starting configurations">
          <div className="strategy-selector response-meter-options">
            {organizationalPresets.map((preset) => {
              const context = organizationalContextCue(preset.id, institutionalValues);
              return (
                <button
                  type="button"
                  key={preset.id}
                  className={`organization-response-card${preset.id === closestOrganizationResponse.id ? " selected" : ""}`}
                  aria-label={`${preset.label}: ${preset.summary}. Under the current institutional environment: ${context.label}. ${context.explanation}`}
                  onClick={() => selectOrganizationPreset(preset)}
                >
                  <span className="organization-response-title-row">
                    <strong>{preset.label}</strong>
                    <span
                      key={`${preset.id}-${context.level}`}
                      className={`strategy-context-cue is-${context.level}`}
                      aria-hidden="true"
                    >
                      <span className="strategy-context-icon">{context.arrow}</span>
                      <span className="strategy-context-popover">
                        <span className="strategy-context-kicker">Under the current institutional environment</span>
                        <span className="strategy-context-label">{context.label}</span>
                        <span className="strategy-context-copy">{context.explanation}</span>
                      </span>
                    </span>
                  </span>
                  <span>{preset.summary}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`organization-decision-board${organizationInView ? " is-revealed" : ""}`}
          key={`organization-decisions-${organizationPresetId}`}
        >
          {organizationControls.slice(0, 3).map((control, index) => (
            <OrganizationDecisionTrack
              key={`${control.field}-${organizationPresetId}`}
              control={control}
              occupation={occupation}
              value={String(organizationalValues[control.field])}
              revealIndex={index}
              onChange={(value) =>
                setOrganizationalOverrides((current) => ({ ...current, [control.field]: value }))
              }
            />
          ))}
        </div>

        <button
          type="button"
          className="expand-button"
          onClick={() => setShowOrganizationDetails((current) => !current)}
          aria-expanded={showOrganizationDetails}
        >
          <SlidersHorizontal size={17} />
          {showOrganizationDetails ? "Hide additional organizational choices" : "More organizational choices"}
        </button>

        {showOrganizationDetails && (
          <div className="organization-assumption-list">
            <p className="organization-assumption-note">
              These contextual assumptions refine the organizational scenario; their downstream effects are not modeled uniformly.
            </p>
            {additionalOrganizationFields.map((field) => {
              const control = organizationControls.find((item) => item.field === field);
              if (!control) return null;
              return (
                <OrganizationAssumptionItem
                  key={field}
                  control={control}
                  value={String(organizationalValues[field])}
                  onChange={(value) =>
                    setOrganizationalOverrides((current) => ({ ...current, [field]: value }))
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <CausalConnector
        label="Organizational choices reorganize tasks, learning, and responsibility"
        pulseKey={`organization-to-work-${scenarioSignature}`}
      />

      <section className="stage-section work-design-section">
        <div className="stage-number">3</div>
        <div className="stage-heading">
          <p className="eyebrow">Work Design Studio</p>
          <h2>How could this work be organized?</h2>
          <p>
            Explore one scenario-informed way this work could be organized, then rearrange the tasks to imagine alternatives.
          </p>
        </div>
        <WorkDesignStudio
          workDesign={workDesign}
          organizationLabel={organizationLabel}
          assignments={scenarioTaskAssignments}
          customTaskLanes={customTaskLanes}
          onMoveTask={moveWorkTask}
          onReset={() => setCustomTaskLanes({})}
        />
      </section>

      <CausalConnector
        label="Different work designs create different pressures on labor outcomes"
        pulseKey={`work-to-outcomes-${scenarioSignature}`}
      />

      <section className="stage-section outcomes-section">
        <div className="stage-number">4</div>
        <div className="stage-heading">
          <p className="eyebrow">Labor outcome tendencies</p>
          <h2>Outcomes move in different directions.</h2>
          <p>
            Your earlier choices create competing pressures across these outcomes.
          </p>
        </div>

        <div className="outcome-divergence-note">
          <p>
            <strong>This divergence is intentional, not a glitch.</strong>{" "}
            A scenario can increase productivity potential while also increasing
            displacement pressure or weakening skill formation. Positions below are
            evidence-informed qualitative tendencies synthesized from matched rules,
            not measured forecasts.
          </p>
        </div>

        <OutcomesExplorer key={scenarioSignature} result={result} />
      </section>

      <CausalConnector
        label="Comparison reveals how the same exposure can travel through different pathways"
        pulseKey={`outcomes-to-compare-${scenarioSignature}`}
      />

      <section className="stage-section compare-cta">
        <div className="stage-number">5</div>
        <div>
          <p className="eyebrow">Comparison is the point</p>
          <h2>Hold the technology constant. Change the pathway.</h2>
          <p>
            Save the current future, then change the institutional arrangement or organizational response above.
          </p>
        </div>
        {comparison ? (
          <div>
            <p>
              <strong>Future A saved.</strong>
            </p>
            <p>
              {comparisonReady
                ? "The current scenario is now Future B in the comparison below."
                : "Change the institutional arrangement or organizational response above to create Future B."}
            </p>
            <button type="button" className="text-button" onClick={saveComparison}>
              Replace Future A with current scenario
            </button>
          </div>
        ) : (
          <button type="button" className="primary-button" onClick={saveComparison}>
            Save as Future A
          </button>
        )}
      </section>

      {comparisonReady && comparison && (
        <ComparePanel
          snapshot={comparison}
          currentInstitutionLabel={institutionLabel}
          currentOrganizationLabel={organizationLabel}
          currentWorkDesign={workDesign}
          currentResult={result}
          onClear={() => setComparison(null)}
        />
      )}

      <section className="evidence-section">
        <details>
          <summary>
            <div>
              <FileText size={18} />
              <span>Explore evidence base</span>
            </div>
            <small>{activeEvidence.length} sources active in this scenario</small>
          </summary>
          <div className="evidence-intro">
            <p>
              The scenario engine links qualitative rules to a coded evidence base. Sources are available here for users who
              want to inspect the reasoning behind the scenario.
            </p>
          </div>
          <EvidencePanel evidence={appEvidenceReferences} activeIds={result.evidenceIds} />
        </details>
      </section>

      <footer className="method-footer">
        <strong>Data foundation:</strong> The explorer uses O*NET occupational, task, and skill data together with AI-exposure data
        from AIOE and OECD to establish the occupational and technological baseline. Academic and policy
        evidence separately informs the scenario logic linking institutional arrangements and organizational choices to labor-market
        tendencies. Outputs are directional explorations, not predictions of individual job outcomes.
      </footer>
      </div>
      <div id="framework-panel" role="tabpanel" aria-labelledby="framework-tab" tabIndex={0} hidden={activeTab !== "framework"}>
        <FrameworkArticle onExplore={() => {
          returnToExplorerTop.current = true;
          setActiveTab("explorer");
        }} />
      </div>
    </main>
  );
}

export default App;
