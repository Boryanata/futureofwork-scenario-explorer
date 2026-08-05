import type { Confidence, OutcomeDimension, OutcomeOutlook, Tendency } from "./types";

const confidenceRank: Record<Confidence, number> = {
  limited: 1,
  moderate: 2,
  stronger: 3,
};

export function strongestConfidence(values: Confidence[]): Confidence {
  if (values.length === 0) {
    return "limited";
  }

  return values.reduce((best, value) =>
    confidenceRank[value] > confidenceRank[best] ? value : best
  );
}

export function tendencyScore(tendency: Tendency, _dimension: OutcomeDimension): number {
  switch (tendency) {
    case "improves":
    case "decreases_risk":
      return 1;
    case "worsens":
    case "increases_risk":
      return -1;
    case "mixed":
    case "contextual":
      return 0;
  }
}

export function scoreToOutlook(score: number, hasOnlyContextualRules: boolean): OutcomeOutlook {
  if (hasOnlyContextualRules) {
    return "contextual";
  }
  if (score >= 0.5) {
    return "favorable";
  }
  if (score <= -0.5) {
    return "unfavorable";
  }
  return "mixed";
}
