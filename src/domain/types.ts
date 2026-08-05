export type ExposureLevel = "low" | "medium" | "high";
export type StrengthLevel = "minimal" | "limited" | "low" | "weak" | "moderate" | "medium" | "strong" | "high";
export type Tendency = "improves" | "worsens" | "mixed" | "contextual" | "increases_risk" | "decreases_risk";
export type Confidence = "limited" | "moderate" | "stronger";

export type OutcomeDimension =
  | "employment"
  | "wages"
  | "mobility"
  | "productivity"
  | "redeployment"
  | "displacement"
  | "skill_accumulation"
  | "job_quality"
  | "distribution_of_gains";

export type ScenarioValue = string | boolean | number | null | undefined;

export type ScenarioOccupation = {
  onetSocCode?: string;
  socCode?: string;
  title?: string;
};

export type ScenarioContext = {
  occupation?: ScenarioOccupation;
  ai_exposure?: ExposureLevel;
  geography?: string;
  ai_governance?: string;
  workforce_development?: string;
  employer_retraining_incentives?: string;
  collective_bargaining?: string;
  social_protection?: string;
  employment_protection?: string;
  algorithmic_transparency?: string;
  worker_information_rights?: string;
  deployment_strategy?: string;
  retraining_commitment?: string;
  junior_work_preservation?: string;
  worker_participation?: string;
  skill_investment_horizon?: string;
  human_oversight?: string;
  task_allocation?: string;
  task_meaning?: string;
  tripartite_coordination?: string;
  job_redesign?: string;
  data_protection?: string;
  anti_discrimination_rules?: string;
  worker_consultation_rights?: string;
  ai_adoption_stage?: string;
  hiring_screening_ai?: boolean;
  [key: string]: ScenarioValue | ScenarioOccupation;
};

export type RuleCondition = {
  field: string;
  operator: "equals" | "in";
  value: string | boolean | number | Array<string | boolean | number>;
};

export type RuleConditionClause = {
  all: RuleCondition[];
};

export type RuleConditionGroup = {
  operator: "all" | "any";
  clauses: RuleConditionClause[];
};

export type ScenarioRule = {
  id: string;
  name: string;
  conditions: RuleConditionGroup;
  geography: string;
  outcome: {
    primary: OutcomeDimension;
    secondary: OutcomeDimension[];
    tendency: Tendency;
    confidence: Confidence;
  };
  work_design_pattern: string;
  narrative_template: string;
  evidence_ids: string[];
  notes: string;
};

export type MatchedRule = ScenarioRule & {
  match: true;
};

export type OutcomeOutlook = "favorable" | "unfavorable" | "mixed" | "contextual";

export type OutcomeResult = {
  dimension: OutcomeDimension;
  outlook: OutcomeOutlook;
  score: number;
  confidence: Confidence;
  summaries: string[];
  evidenceIds: string[];
  ruleIds: string[];
  workDesignPatterns: string[];
};

export type ScenarioResult = {
  context: ScenarioContext;
  matchedRules: MatchedRule[];
  outcomes: OutcomeResult[];
  evidenceIds: string[];
};
