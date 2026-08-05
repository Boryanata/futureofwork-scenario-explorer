import { buildOutcomeSummary } from "./explanations";
import { scoreToOutlook, strongestConfidence, tendencyScore } from "./scoring";
import type {
  MatchedRule,
  OutcomeDimension,
  OutcomeResult,
  RuleCondition,
  RuleConditionClause,
  RuleConditionGroup,
  ScenarioContext,
  ScenarioResult,
  ScenarioRule,
  ScenarioValue,
} from "./types";

function getContextValue(context: ScenarioContext, field: string): ScenarioValue {
  const value = context[field];
  if (typeof value === "object") {
    return undefined;
  }
  return value;
}

function matchesCondition(context: ScenarioContext, condition: RuleCondition): boolean {
  const actual = getContextValue(context, condition.field);

  switch (condition.operator) {
    case "equals":
      return actual === condition.value;
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(actual as string | boolean | number);
  }
}

function matchesClause(context: ScenarioContext, clause: RuleConditionClause): boolean {
  return clause.all.every((condition) => matchesCondition(context, condition));
}

export function matchesConditionGroup(context: ScenarioContext, group: RuleConditionGroup): boolean {
  if (group.operator === "all") {
    return group.clauses.every((clause) => matchesClause(context, clause));
  }
  return group.clauses.some((clause) => matchesClause(context, clause));
}

export function findMatchingRules(context: ScenarioContext, rules: ScenarioRule[]): MatchedRule[] {
  return rules
    .filter((rule) => matchesConditionGroup(context, rule.conditions))
    .map((rule) => ({ ...rule, match: true }));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function addRuleToOutcomeBucket(
  buckets: Map<OutcomeDimension, MatchedRule[]>,
  dimension: OutcomeDimension,
  rule: MatchedRule
) {
  const existing = buckets.get(dimension) ?? [];
  existing.push(rule);
  buckets.set(dimension, existing);
}

export function summarizeOutcomes(matchedRules: MatchedRule[]): OutcomeResult[] {
  const buckets = new Map<OutcomeDimension, MatchedRule[]>();

  for (const rule of matchedRules) {
    addRuleToOutcomeBucket(buckets, rule.outcome.primary, rule);
    for (const secondaryOutcome of rule.outcome.secondary) {
      if (secondaryOutcome !== rule.outcome.primary) {
        addRuleToOutcomeBucket(buckets, secondaryOutcome, rule);
      }
    }
  }

  return Array.from(buckets.entries())
    .map(([dimension, rules]) => {
      const scores = rules.map((rule) => tendencyScore(rule.outcome.tendency, dimension));
      const score = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      const hasOnlyContextualRules = rules.every((rule) =>
        ["contextual", "mixed"].includes(rule.outcome.tendency)
      );
      const outlook = scoreToOutlook(score, hasOnlyContextualRules);

      return {
        dimension,
        outlook,
        score: Number(score.toFixed(2)),
        confidence: strongestConfidence(rules.map((rule) => rule.outcome.confidence)),
        summaries: [
          buildOutcomeSummary(dimension, outlook),
          ...rules.map((rule) => rule.narrative_template),
        ],
        evidenceIds: unique(rules.flatMap((rule) => rule.evidence_ids)),
        ruleIds: rules.map((rule) => rule.id),
        workDesignPatterns: unique(rules.map((rule) => rule.work_design_pattern)),
      };
    })
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || a.dimension.localeCompare(b.dimension));
}

export function evaluateScenario(context: ScenarioContext, rules: ScenarioRule[]): ScenarioResult {
  const matchedRules = findMatchingRules(context, rules);
  const outcomes = summarizeOutcomes(matchedRules);

  return {
    context,
    matchedRules,
    outcomes,
    evidenceIds: unique(matchedRules.flatMap((rule) => rule.evidence_ids)),
  };
}
