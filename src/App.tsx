import { useMemo, useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Gauge,
  GraduationCap,
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
import { formatOutcomeLabel, formatOutlookLabel } from "./domain/explanations";
import type { OutcomeResult, ScenarioContext, ScenarioResult } from "./domain/types";

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
  options: string[];
};

type WorkDesign = {
  label: string;
  summary: string;
};

const institutionalPresets: Preset[] = [
  {
    id: "minimal",
    label: "Minimal Safeguards",
    shortLabel: "Minimal",
    summary: "Weak governance and limited transition support.",
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
    id: "managed",
    label: "Managed Transition",
    shortLabel: "Managed",
    summary: "Public training, moderate rules, partial protection.",
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
    id: "worker_centered",
    label: "Worker-Centered Governance",
    shortLabel: "Worker-Centered",
    summary: "Rights, voice, social protection, and training capacity.",
    values: {
      ai_governance: "rights_based",
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
    id: "automation_first",
    label: "Automation-First",
    shortLabel: "Automation",
    summary: "Task substitution with little redesign or retraining.",
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
    id: "mixed",
    label: "Mixed Adoption",
    shortLabel: "Mixed",
    summary: "Some augmentation, some substitution, uneven implementation.",
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
    id: "augmentation",
    label: "Augmentation & Redesign",
    shortLabel: "Augmentation",
    summary: "AI supports work while jobs and skills are redesigned.",
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
  { field: "ai_governance", label: "AI Governance", options: ["weak", "moderate", "co_governed", "rights_based"] },
  { field: "algorithmic_transparency", label: "Algorithmic Transparency", options: ["limited", "moderate", "strong"] },
  { field: "worker_information_rights", label: "Worker Information Rights", options: ["limited", "moderate", "strong"] },
  { field: "data_protection", label: "Data Protection", options: ["weak", "moderate", "strong"] },
  { field: "anti_discrimination_rules", label: "Anti-Discrimination Rules", options: ["weak", "moderate", "strong"] },
  { field: "collective_bargaining", label: "Collective Bargaining", options: ["weak", "moderate", "strong"] },
  { field: "workforce_development", label: "Workforce Development", options: ["weak", "moderate", "strong"] },
  { field: "employer_retraining_incentives", label: "Retraining Incentives", options: ["low", "moderate", "high"] },
  { field: "active_labor_market_policy", label: "Active Labor Policy", options: ["weak", "moderate", "strong"] },
  { field: "social_protection", label: "Social Protection", options: ["minimal", "moderate", "strong"] },
  { field: "employment_protection", label: "Employment Protection", options: ["weak", "moderate", "strong"] },
];

const organizationControls: ControlConfig[] = [
  { field: "deployment_strategy", label: "Deployment Strategy", options: ["automation_first", "hybrid", "augmentation"] },
  { field: "retraining_commitment", label: "Retraining Commitment", options: ["none", "selective", "broad"] },
  { field: "worker_participation", label: "Worker Participation", options: ["low", "medium", "high"] },
  { field: "worker_consultation_rights", label: "Consultation Rights", options: ["weak", "moderate", "strong"] },
  { field: "human_oversight", label: "Human Oversight", options: ["low", "medium", "high", "required"] },
  { field: "task_allocation", label: "Task Allocation", options: ["unclear", "clear"] },
  { field: "task_meaning", label: "Task Meaning", options: ["low", "high"] },
  { field: "skill_investment_horizon", label: "Skill Horizon", options: ["short", "medium", "long"] },
  { field: "job_redesign", label: "Job Redesign", options: ["inactive", "active"] },
  { field: "ai_adoption_stage", label: "AI Adoption Stage", options: ["post_deployment", "pre_deployment"] },
];

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

function buildContext(
  occupation: OccupationProfile,
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
    geography: "general",
    ...institutionalValues,
    ...organizationalValues,
  };
}

function deriveWorkDesign(institutionPresetId: string, organizationPresetId: string): WorkDesign {
  if (organizationPresetId === "automation_first" && institutionPresetId === "minimal") {
    return {
      label: "Substitution-Centered Design",
      summary: "AI is likely to be used to remove or compress tasks, with limited worker input and weak transition supports.",
    };
  }
  if (organizationPresetId === "automation_first") {
    return {
      label: "Constrained Automation",
      summary: "The organization still pursues substitution, but stronger institutions can create oversight, consultation, or training obligations.",
    };
  }
  if (organizationPresetId === "mixed") {
    return {
      label: "Uneven Hybrid Work",
      summary: "Some tasks are augmented while others are automated, so outcomes depend heavily on where redesign and training are actually applied.",
    };
  }
  if (institutionPresetId === "worker_centered") {
    return {
      label: "Participatory Augmentation",
      summary: "AI is more likely to complement work because adoption is paired with oversight, worker voice, and skill development.",
    };
  }
  return {
    label: "Firm-Led Augmentation",
    summary: "AI is oriented toward support and redesign, but worker outcomes depend on how consistently training and participation are implemented.",
  };
}

function summarizeScenario(
  result: ScenarioResult,
  institutionPreset: Preset,
  organizationPreset: Preset,
  workDesign: WorkDesign,
): string {
  if (organizationPreset.id === "automation_first" && institutionPreset.id === "minimal") {
    return `Weak safeguards and automation-first deployment push this scenario toward displacement and job-quality risk. The central pathway is ${workDesign.label.toLowerCase()}.`;
  }
  if (organizationPreset.id === "automation_first") {
    return `Automation pressure remains high, but ${institutionPreset.label.toLowerCase()} can buffer the pathway through oversight, bargaining, or retraining requirements.`;
  }
  if (organizationPreset.id === "mixed") {
    return `Mixed adoption creates an uneven pathway: some work is redesigned around AI support, while other tasks may still be substituted or monitored.`;
  }
  if (institutionPreset.id === "minimal") {
    return `Augmentation improves the organizational posture, but weak institutions leave worker gains more dependent on firm choice than enforceable protections.`;
  }
  return `${institutionPreset.label} and ${organizationPreset.label.toLowerCase()} point toward a more supportive pathway through training, worker voice, oversight, and job redesign.`;
}

function SelectControl({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="control" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {titleCase(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SegmentedChoice({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: Preset[];
  selectedId: string;
  onSelect: (preset: Preset) => void;
}) {
  return (
    <section className="choice-line" aria-label={label}>
      <h2>{label}</h2>
      <div className="segment-group">
        {options.map((option) => (
          <button
            className={option.id === selectedId ? "selected" : ""}
            key={option.id}
            type="button"
            onClick={() => onSelect(option)}
          >
            <strong>{option.shortLabel}</strong>
            <span>{option.summary}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function outcomeTileClass(index: number): string {
  if (index === 0) return "tile-large";
  if (index === 1 || index === 2) return "tile-medium";
  return "tile-small";
}

function OutcomeTile({ outcome, index }: { outcome: OutcomeResult; index: number }) {
  return (
    <article className={`outcome-tile ${outcomeTileClass(index)} outcome-${outcome.outlook}`}>
      <div>
        <h3>{formatOutcomeLabel(outcome.dimension)}</h3>
        <span>{formatOutlookLabel(outcome.outlook)}</span>
      </div>
      <p>{outcome.summaries[0]}</p>
    </article>
  );
}

function AdvancedAssumptionsContent({
  institutionalValues,
  organizationalValues,
  onInstitutionChange,
  onOrganizationChange,
}: {
  institutionalValues: Record<string, string | boolean>;
  organizationalValues: Record<string, string | boolean>;
  onInstitutionChange: (field: string, value: string) => void;
  onOrganizationChange: (field: string, value: string | boolean) => void;
}) {
  return (
    <div className="advanced-grid">
      <div>
        <h3>Institutional Variables</h3>
        <div className="control-grid">
          {institutionalControls.map((control) => (
            <SelectControl
              key={control.field}
              id={`advanced-${control.field}`}
              label={control.label}
              value={String(institutionalValues[control.field])}
              options={control.options}
              onChange={(value) => onInstitutionChange(control.field, value)}
            />
          ))}
        </div>
      </div>
      <div>
        <h3>Organizational Variables</h3>
        <div className="control-grid">
          {organizationControls.map((control) => (
            <SelectControl
              key={control.field}
              id={`advanced-${control.field}`}
              label={control.label}
              value={String(organizationalValues[control.field])}
              options={control.options}
              onChange={(value) => onOrganizationChange(control.field, value)}
            />
          ))}
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={Boolean(organizationalValues.hiring_screening_ai)}
            onChange={(event) => onOrganizationChange("hiring_screening_ai", event.target.checked)}
          />
          <span>Hiring or promotion screening uses AI</span>
        </label>
      </div>
    </div>
  );
}

function OccupationDetailContent({ occupation }: { occupation: OccupationProfile }) {
  return (
    <div className="detail-grid">
      <div>
        <h3>Top Tasks</h3>
        <ul>
          {occupation.tasks.slice(0, 5).map((task) => (
            <li key={task.id}>{task.text}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3>Skills</h3>
        <div className="chip-row">
          {[...occupation.skills.essential, ...occupation.skills.transferable].slice(0, 10).map((skill) => (
            <span className="chip" key={`${skill.type}-${skill.id}`}>{skill.name}</span>
          ))}
        </div>
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
            <span>{titleCase(item.confidence)}</span>
          </div>
          <p>{item.claim_summary}</p>
          <small>{item.citation}{item.page_ref ? `, p. ${item.page_ref}` : ""}</small>
        </article>
      ))}
    </div>
  );
}

function App() {
  const defaultOccupation = findOccupation("Customer Service Representatives");
  const [occupationCode, setOccupationCode] = useState(defaultOccupation.onet_soc_code);
  const [query, setQuery] = useState("");
  const [institutionPresetId, setInstitutionPresetId] = useState("managed");
  const [organizationPresetId, setOrganizationPresetId] = useState("augmentation");
  const [institutionalOverrides, setInstitutionalOverrides] = useState<Record<string, string>>({});
  const [organizationalOverrides, setOrganizationalOverrides] = useState<Record<string, string | boolean>>({});

  const occupation = appOccupations.find((item) => item.onet_soc_code === occupationCode) ?? defaultOccupation;
  const institutionPreset = institutionalPresets.find((preset) => preset.id === institutionPresetId) ?? institutionalPresets[1];
  const organizationPreset = organizationalPresets.find((preset) => preset.id === organizationPresetId) ?? organizationalPresets[2];
  const institutionalValues = { ...institutionPreset.values, ...institutionalOverrides };
  const organizationalValues = { ...organizationPreset.values, ...organizationalOverrides };
  const result = evaluateScenario(buildContext(occupation, institutionalValues, organizationalValues), appScenarioRules);
  const workDesign = deriveWorkDesign(institutionPresetId, organizationPresetId);
  const keyOutcomes = result.outcomes.slice(0, 5);
  const activeEvidence = appEvidenceReferences.filter((item) => result.evidenceIds.includes(item.source_id));

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
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>AI & Labor Futures</h1>
        </div>
        <div className="topbar-status">
          <CheckCircle2 size={18} />
          <span>{result.matchedRules.length} evidence rules matched</span>
        </div>
      </header>

      <section className="explorer-shell">
        <aside className="occupation-panel">
          <div className="occupation-card occupation-picker">
            <div className="fact-title">
              <BriefcaseBusiness size={17} />
              <span>Occupation</span>
            </div>
            <label className="search-box" htmlFor="occupation-search">
              <Search size={16} />
              <input
                id="occupation-search"
                value={query}
                placeholder="Search title"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            {query.trim() && (
              <div className="search-results" aria-label="Occupation search results">
                {searchResults.map((item) => (
                  <button
                    key={item.onet_soc_code}
                    type="button"
                    onClick={() => selectOccupation(item)}
                  >
                    {item.title}
                  </button>
                ))}
                {searchResults.length === 0 && <p>No matching occupations.</p>}
              </div>
            )}

            <label className="control" htmlFor="occupation-select">
              <span>Choose occupation</span>
              <select
                id="occupation-select"
                value={occupationCode}
                onChange={(event) => setOccupationCode(event.target.value)}
              >
                {appOccupations.map((item) => (
                  <option key={item.onet_soc_code} value={item.onet_soc_code}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="exposure-block">
            <div className="fact-title">
              <Gauge size={17} />
              <span>AI Exposure</span>
            </div>
            <strong>{titleCase(occupation.exposure_baseline.combined_level ?? "unknown")}</strong>
            <p>
              How much of this occupation's work could be affected by current AI systems.
            </p>
            <small>
              Score: {occupation.exposure_baseline.combined_score ?? "n/a"} on a 0-1 scale.
            </small>
          </div>

          <div className="compact-facts">
            <div className="compact-fact">
              <div className="fact-title">
                <GraduationCap size={17} />
                <span>Preparation Level</span>
              </div>
              <strong>{preparationLabel(occupation)}</strong>
              <small>
                {occupation.job_zone
                  ? `O*NET Job Zone ${occupation.job_zone.zone}: typical education, experience, and training needed.`
                  : "O*NET Job Zone: typical education, experience, and training needed."}
              </small>
            </div>
          </div>

          <nav className="side-actions" aria-label="Supporting sections">
            <a className="side-action" href="#occupation-detail">
              <BookOpen size={17} />
              <span>Occupation detail</span>
            </a>
            <a className="side-action" href="#advanced-assumptions">
              <SlidersHorizontal size={17} />
              <span>Advanced assumptions</span>
            </a>
            <a className="side-action" href="#evidence-used">
              <FileText size={17} />
              <span>Evidence used ({activeEvidence.length})</span>
            </a>
          </nav>
        </aside>

        <section className="pathway-stage">
          <div className="choice-deck">
            <SegmentedChoice
              label="Institutional Conditions"
              options={institutionalPresets}
              selectedId={institutionPresetId}
              onSelect={(preset) => {
                setInstitutionPresetId(preset.id);
                setInstitutionalOverrides({});
              }}
            />
            <SegmentedChoice
              label="Organizational Strategy"
              options={organizationalPresets}
              selectedId={organizationPresetId}
              onSelect={(preset) => {
                setOrganizationPresetId(preset.id);
                setOrganizationalOverrides({});
              }}
            />
          </div>

          <section className="outcome-board">
            <div className="board-heading">
              <p className="eyebrow">Labor Outcome Tendencies</p>
            </div>
            <div className="outcome-mosaic">
              {keyOutcomes.map((outcome, index) => (
                <OutcomeTile key={outcome.dimension} outcome={outcome} index={index} />
              ))}
            </div>
          </section>

          <section className="scenario-summary">
            <div className="readout-copy">
              <p className="eyebrow">Scenario Readout</p>
              <h2>{occupation.title}</h2>
              <p>{summarizeScenario(result, institutionPreset, organizationPreset, workDesign)}</p>
              <p className="readout-note">
                AI exposure is treated as the starting condition. This scenario shows how institutional and employer
                settings may shape the labor outcomes that follow.
              </p>
            </div>
          </section>

          <section className="main-detail-panel" id="occupation-detail">
            <div className="main-detail-title">
              <BookOpen size={18} />
              <h2>Occupation detail</h2>
            </div>
            <OccupationDetailContent occupation={occupation} />
          </section>

          <section className="main-detail-panel" id="advanced-assumptions">
            <div className="main-detail-title">
              <SlidersHorizontal size={18} />
              <h2>Advanced assumptions</h2>
            </div>
            <AdvancedAssumptionsContent
              institutionalValues={institutionalValues}
              organizationalValues={organizationalValues}
              onInstitutionChange={(field, value) => {
                setInstitutionalOverrides((current) => ({ ...current, [field]: value }));
              }}
              onOrganizationChange={(field, value) => {
                setOrganizationalOverrides((current) => ({ ...current, [field]: value }));
              }}
            />
          </section>

          <section className="main-detail-panel" id="evidence-used">
            <div className="main-detail-title">
              <FileText size={18} />
              <h2>Evidence used ({activeEvidence.length})</h2>
            </div>
            <EvidencePanel evidence={appEvidenceReferences} activeIds={result.evidenceIds} />
          </section>
        </section>
      </section>
    </main>
  );
}

export default App;
