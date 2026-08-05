import type { OutcomeDimension, OutcomeOutlook } from "./types";

const outcomeLabels: Record<OutcomeDimension, string> = {
  employment: "Employment",
  wages: "Wages",
  mobility: "Mobility",
  productivity: "Productivity",
  redeployment: "Redeployment",
  displacement: "Displacement Risk",
  skill_accumulation: "Skill Accumulation",
  job_quality: "Job Quality",
  distribution_of_gains: "Distribution of Gains",
};

const outlookLabels: Record<OutcomeOutlook, string> = {
  favorable: "Favorable tendency",
  unfavorable: "Higher risk tendency",
  mixed: "Mixed tendency",
  contextual: "Contextual evidence",
};

export function formatOutcomeLabel(dimension: OutcomeDimension): string {
  return outcomeLabels[dimension];
}

export function formatOutlookLabel(outlook: OutcomeOutlook): string {
  return outlookLabels[outlook];
}

export function buildOutcomeSummary(dimension: OutcomeDimension, outlook: OutcomeOutlook): string {
  const label = formatOutcomeLabel(dimension).toLowerCase();

  switch (outlook) {
    case "favorable":
      return `The matched evidence suggests a more favorable ${label} tendency under this scenario.`;
    case "unfavorable":
      return `The matched evidence suggests elevated ${label} risk under this scenario.`;
    case "mixed":
      return `The matched evidence is mixed for ${label} under this scenario.`;
    case "contextual":
      return `The matched evidence helps contextualize ${label}, but does not imply a directional prediction.`;
  }
}
