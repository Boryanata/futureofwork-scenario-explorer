import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  FileText,
  Gauge,
  GraduationCap,
  Lock,
  Search,
  SlidersHorizontal,
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
import type {
  OutcomeDimension,
  OutcomeResult,
  ScenarioContext,
  ScenarioResult,
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

type OrganizationControlContext = {
  helper: string;
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

const organizationControls: ControlConfig[] = [
  { field: "deployment_strategy", label: "Deployment strategy", options: ["automation_first", "hybrid", "augmentation"] },
  { field: "retraining_commitment", label: "Retraining / role transition", options: ["none", "selective", "broad"] },
  { field: "worker_participation", label: "Worker participation in work redesign", options: ["low", "medium", "high"] },
  { field: "worker_consultation_rights", label: "Consultation rights", options: ["weak", "moderate", "strong"] },
  { field: "human_oversight", label: "Human oversight", options: ["low", "medium", "high", "required"] },
  { field: "task_allocation", label: "Task allocation", options: ["unclear", "clear"] },
  { field: "task_meaning", label: "Task meaning", options: ["low", "high"] },
  { field: "skill_investment_horizon", label: "Skill investment horizon", options: ["short", "medium", "long"] },
  { field: "job_redesign", label: "Job redesign", options: ["inactive", "active"] },
  { field: "ai_adoption_stage", label: "AI adoption stage", options: ["post_deployment", "pre_deployment"] },
];

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

function findOccupation(defaultTitle: string): OccupationProfile {
  return appOccupations.find((occupation) => occupation.title === defaultTitle) ?? appOccupations[0];
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

function organizationControlContext(occupation: OccupationProfile, field: string): OrganizationControlContext {
  if (field === "deployment_strategy") {
    return {
      helper: `For ${occupation.title}, this shapes whether AI is used primarily to substitute parts of the work or to support human-led tasks and workflows.`,
    };
  }

  if (field === "retraining_commitment") {
    return {
      helper: `For ${occupation.title}, this shapes whether workers are prepared for redesigned responsibilities, adjacent roles, or new ways of working as tasks change.`,
    };
  }

  if (field === "worker_participation") {
    return {
      helper: `For ${occupation.title}, this shapes how much workers influence workflow design, task allocation, and the introduction of AI into everyday work.`,
    };
  }

  if (field === "worker_consultation_rights") {
    return {
      helper: `For ${occupation.title}, this shapes the process around technology introduction, including notice, task reassignment, monitoring, and oversight.`,
    };
  }

  return {
    helper: `This choice changes how ${occupation.title} work is organized under the scenario.`,
  };
}

function organizationalEnvironmentNote(
  presetId: string,
  institutionalValues: Record<string, string | boolean>,
): string {
  const governance = String(institutionalValues.ai_governance);
  const bargaining = String(institutionalValues.collective_bargaining);
  const workforce = String(institutionalValues.workforce_development);
  const retraining = String(institutionalValues.employer_retraining_incentives);
  const employmentProtection = String(institutionalValues.employment_protection);
  const informationRights = String(institutionalValues.worker_information_rights);

  if (presetId === "automation_oriented") {
    if (governance === "weak" && bargaining === "weak" && employmentProtection === "weak") {
      return "Relatively few institutional constraints limit this strategy.";
    }
    if (["co_governed", "rights_based"].includes(governance) || bargaining === "strong" || employmentProtection === "strong") {
      return "This strategy faces stronger negotiation, oversight, or protection constraints.";
    }
    return "This strategy remains possible, with some procedural constraints.";
  }

  if (presetId === "hybrid_redesign") {
    if (workforce === "strong" || retraining === "high") {
      return "Stronger training capacity makes work redesign easier to support.";
    }
    return "Redesign depends more heavily on firm-level capacity and investment.";
  }

  if (workforce === "strong" && (bargaining === "strong" || informationRights === "strong") && retraining === "high") {
    return "There is stronger support for retraining, worker voice, and redeployment.";
  }
  if (workforce === "strong" || retraining === "high") {
    return "Training infrastructure supports this strategy, while worker voice and redeployment commitments may vary.";
  }
  return "This strategy is possible, but depends more heavily on voluntary firm investment.";
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
  const words = label.split(" ");
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


function DimensionSlider({
  control,
  value,
  onChange,
}: {
  control: ControlConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  const index = Math.max(0, control.options.indexOf(value));
  return (
    <div className="dimension-row">
      <div className="dimension-copy">
        <strong>{control.label}</strong>
        <span>{titleCase(value)}</span>
      </div>
      <div className="dimension-slider-wrap">
        <input
          aria-label={control.label}
          className="dimension-slider"
          type="range"
          min={0}
          max={control.options.length - 1}
          step={1}
          value={index}
          onChange={(event) => onChange(control.options[Number(event.target.value)])}
        />
        <div className="dimension-ends">
          <span>{titleCase(control.options[0])}</span>
          <span>{titleCase(control.options[control.options.length - 1])}</span>
        </div>
      </div>
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

function OutcomeMovement({ outcome }: { outcome: OutcomeResult }) {
  const meta = directionMeta[outcome.dimension];
  const score = Math.max(-1, Math.min(1, outcome.score));
  const position = 50 + score * 42;
  const movement =
    score > 0.2
      ? `Moves toward ${meta.right}`
      : score < -0.2
        ? `Moves toward ${meta.left}`
        : "Mixed or context-dependent movement";

  return (
    <article className="outcome-movement">
      <div className="outcome-heading">
        <div>
          <h3>{formatOutcomeLabel(outcome.dimension)}</h3>
          <p>{movement}</p>
        </div>
      </div>
      <div className="movement-scale" aria-label={`${formatOutcomeLabel(outcome.dimension)}: ${movement}`}>
        <div className="movement-track">
          <span className="movement-center" />
          <span className="movement-marker" style={{ left: `${position}%` }} />
        </div>
        <div className="movement-labels">
          <span>{meta.left}</span>
          <span>{meta.right}</span>
        </div>
      </div>
    </article>
  );
}

function OrganizationDecisionTrack({
  control,
  value,
  occupation,
  onChange,
}: {
  control: ControlConfig;
  value: string;
  occupation: OccupationProfile;
  onChange: (value: string) => void;
}) {
  const index = Math.max(0, control.options.indexOf(value));
  const context = organizationControlContext(occupation, control.field);

  return (
    <article className="organization-decision-track">
      <div className="organization-decision-copy">
        <div className="decision-title-row">
          <strong>{control.label}</strong>
          <span>{titleCase(value)}</span>
        </div>
        <p>{context.helper}</p>
      </div>
      <div className="decision-track-control">
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
          The starting arrangement uses this occupation's O*NET task descriptions and the selected scenario to imagine how
          work could be divided. It is a work-design prompt, not a prediction or estimated task share.
        </p>
        <button type="button" className="text-button reset-studio" onClick={onReset} disabled={!customized}>
          Reset to scenario
        </button>
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
                  title={`${assignment.task.text}\n\n${assignment.rationale}\n\nDrag horizontally to another lane to explore a different work design.`}
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
                  <small>drag horizontally</small>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {customized ? (
        <div className="studio-mode-note custom">
          <strong>You are exploring your own work-design imaginary.</strong>
          <span>
            The outcome movements below still reflect the model-supported institutional and organizational scenario; your
            manual task arrangement is kept separate from those outputs.
          </span>
        </div>
      ) : (
        <div className="studio-mode-note">
          <strong>Make it yours.</strong>
          <span>Drag the task objects between lanes to explore alternative ways this occupation could be organized.</span>
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
  const [comparison, setComparison] = useState<ComparisonSnapshot | null>(null);
  const [customTaskLanes, setCustomTaskLanes] = useState<Record<string, WorkLane>>({});

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

  const filteredOccupations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = normalized
      ? appOccupations.filter((item) =>
          `${item.title} ${item.onet_soc_code} ${item.soc_code}`.toLowerCase().includes(normalized),
        )
      : appOccupations;
    return matches.some((item) => item.onet_soc_code === occupation.onet_soc_code)
      ? matches
      : [occupation, ...matches];
  }, [occupation, query]);

  const searchResults = query.trim() ? filteredOccupations.slice(0, 8) : [];

  function selectOccupation(nextOccupation: OccupationProfile) {
    setOccupationCode(nextOccupation.onet_soc_code);
    setQuery("");
    setComparison(null);
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
      occupationTitle: occupation.title,
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
                placeholder="Search occupation title"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {query.trim() && (
              <div className="search-results" aria-label="Occupation search results">
                {searchResults.map((item) => (
                  <button key={item.onet_soc_code} type="button" onClick={() => selectOccupation(item)}>
                    {item.title}
                  </button>
                ))}
                {searchResults.length === 0 && <p>No matching occupations.</p>}
              </div>
            )}
            <label className="select-line" htmlFor="occupation-select">
              <span>Selected occupation</span>
              <select
                id="occupation-select"
                value={occupationCode}
                onChange={(event) => {
                  setOccupationCode(event.target.value);
                  setComparison(null);
                }}
              >
                {appOccupations.map((item) => (
                  <option key={item.onet_soc_code} value={item.onet_soc_code}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="baseline-lock">
            <div className="lock-line">
              <Lock size={18} />
              <span>Held constant in this scenario</span>
            </div>
            <h2>{occupation.title}</h2>
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

        <details className="quiet-details">
          <summary>
            <BookOpen size={16} />
            Occupation detail
          </summary>
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
        </details>
      </section>

      <CausalConnector
        label="AI exposure is the baseline; institutions mediate what happens next"
        pulseKey={`baseline-to-institution-${occupation.onet_soc_code}`}
        showPulse={false}
      />

      <section className="stage-section institution-section">
        <div className="stage-number">1</div>
        <div className="stage-heading">
          <p className="eyebrow">Institutional environment</p>
          <h2>What institutional environment is shaping the transition?</h2>
          <p>Start with an institutional arrangement, then explore how its components work together.</p>
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
          <div className="dimension-list">
            {institutionalControls.map((control) => (
              <DimensionSlider
                key={control.field}
                control={control}
                value={String(institutionalValues[control.field])}
                onChange={(value) => updateInstitutionalOverride(control.field, value)}
              />
            ))}
          </div>
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

      <section className="stage-section organization-section">
        <div className="stage-number">2</div>
        <div className="stage-heading">
          <p className="eyebrow">Organizational response</p>
          <h2>What does the employer choose to do inside that environment?</h2>
          <p>Choose how the employer deploys AI, invests in workers, and shares decisions.</p>
        </div>

        <div className="strategy-selector">
          {organizationalPresets.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={preset.id === organizationPresetId ? "selected" : ""}
              onClick={() => selectOrganizationPreset(preset)}
            >
              <strong>{preset.label}</strong>
              <span>{preset.summary}</span>
              {preset.id === organizationPresetId && (
                <small className="strategy-context">
                  <span className="strategy-context-label">Under the current institutional environment:</span>
                  <span className="strategy-context-copy">{organizationalEnvironmentNote(preset.id, institutionalValues)}</span>
                </small>
              )}
            </button>
          ))}
        </div>

        <div className="organization-decision-board">
          {organizationControls.slice(0, 3).map((control) => (
            <OrganizationDecisionTrack
              key={control.field}
              control={control}
              occupation={occupation}
              value={String(organizationalValues[control.field])}
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
          {showOrganizationDetails ? "Hide additional organizational assumptions" : "See additional organizational assumptions"}
        </button>

        {showOrganizationDetails && (
          <div className="dimension-list organization-dimensions">
            {organizationControls.slice(3).map((control) => (
              <DimensionSlider
                key={control.field}
                control={control}
                value={String(organizationalValues[control.field])}
                onChange={(value) =>
                  setOrganizationalOverrides((current) => ({ ...current, [control.field]: value }))
                }
              />
            ))}
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
            Productivity, employment, job quality, skill formation, and displacement can move in different directions — they are not a single score.
          </p>
        </div>

        <div className="outcome-method-note">
          <p>
            <strong>This divergence is intentional, not a glitch.</strong>{" "}
            A scenario can increase productivity potential while also increasing displacement pressure or weakening skill
            formation. Positions below are evidence-informed qualitative tendencies synthesized from matched rules, not measured forecasts.
          </p>
        </div>

        <div className="outcomes-list">
          {result.outcomes.map((outcome) => (
            <OutcomeMovement key={outcome.dimension} outcome={outcome} />
          ))}
        </div>
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
        from OECD and the Anthropic Economic Index to establish the occupational and technological baseline. Academic and policy
        evidence separately informs the scenario logic linking institutional arrangements and organizational choices to labor-market
        tendencies. Outputs are directional explorations, not predictions of individual job outcomes.
      </footer>
    </main>
  );
}

export default App;
