#!/usr/bin/env node
import { readFileSync } from "node:fs";

const rulesPayload = JSON.parse(readFileSync("data/processed/scenario_rules.json", "utf8"));
const geographyPresets = JSON.parse(readFileSync("data/processed/geography_presets.json", "utf8"));
const occupations = JSON.parse(readFileSync("data/processed/occupations.json", "utf8"));

function matchesCondition(context, condition) {
  const actual = context[condition.field];
  if (condition.operator === "equals") {
    return actual === condition.value;
  }
  if (condition.operator === "in") {
    return Array.isArray(condition.value) && condition.value.includes(actual);
  }
  return false;
}

function matchesGroup(context, group) {
  const clauseMatches = group.clauses.map((clause) =>
    clause.all.every((condition) => matchesCondition(context, condition)),
  );
  return group.operator === "all"
    ? clauseMatches.every(Boolean)
    : clauseMatches.some(Boolean);
}

function tendencyScore(tendency) {
  if (tendency === "improves" || tendency === "decreases_risk") return 1;
  if (tendency === "worsens" || tendency === "increases_risk") return -1;
  return 0;
}

function outlook(score, onlyContextual) {
  if (onlyContextual) return "contextual";
  if (score >= 0.5) return "favorable";
  if (score <= -0.5) return "unfavorable";
  return "mixed";
}

function unique(values) {
  return Array.from(new Set(values));
}

function evaluateScenario(context, rules) {
  const matchedRules = rules.filter((rule) => matchesGroup(context, rule.conditions));
  const buckets = new Map();

  for (const rule of matchedRules) {
    const dimensions = [rule.outcome.primary, ...rule.outcome.secondary];
    for (const dimension of new Set(dimensions)) {
      buckets.set(dimension, [...(buckets.get(dimension) ?? []), rule]);
    }
  }

  const outcomes = Array.from(buckets.entries()).map(([dimension, bucketRules]) => {
    const scores = bucketRules.map((rule) => tendencyScore(rule.outcome.tendency));
    const score = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    const onlyContextual = bucketRules.every((rule) =>
      ["contextual", "mixed"].includes(rule.outcome.tendency),
    );
    return {
      dimension,
      outlook: outlook(score, onlyContextual),
      score: Number(score.toFixed(2)),
      ruleIds: bucketRules.map((rule) => rule.id),
      evidenceIds: unique(bucketRules.flatMap((rule) => rule.evidence_ids)),
    };
  });

  outcomes.sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || a.dimension.localeCompare(b.dimension));

  return {
    matchedRuleCount: matchedRules.length,
    matchedRuleIds: matchedRules.map((rule) => rule.id),
    outcomes,
  };
}

function preset(id) {
  return geographyPresets.find((item) => item.id === id);
}

function occupation(title) {
  return occupations.find((item) => item.title === title);
}

function scenarioFromPreset({ occupationTitle, geography, organizational }) {
  const occ = occupation(occupationTitle);
  const geo = preset(geography);

  return {
    occupation: {
      onetSocCode: occ?.onet_soc_code,
      socCode: occ?.soc_code,
      title: occ?.title,
    },
    ai_exposure: occ?.exposure_baseline?.combined_level ?? "medium",
    geography,
    ...geo?.institutional_arrangement,
    ...organizational,
  };
}

const scenarios = [
  {
    name: "Automation-first, weak support",
    context: scenarioFromPreset({
      occupationTitle: "Customer Service Representatives",
      geography: "united_states",
      organizational: {
        deployment_strategy: "automation_first",
        retraining_commitment: "none",
        worker_participation: "low",
        ai_governance: "weak",
        workforce_development: "weak",
        human_oversight: "low",
        task_meaning: "high",
      },
    }),
  },
  {
    name: "Worker-centered augmentation",
    context: scenarioFromPreset({
      occupationTitle: "Customer Service Representatives",
      geography: "denmark",
      organizational: {
        deployment_strategy: "augmentation",
        retraining_commitment: "broad",
        worker_participation: "high",
        human_oversight: "high",
        task_allocation: "clear",
        skill_investment_horizon: "long",
        active_labor_market_policy: "strong",
        collective_bargaining: "strong",
      },
    }),
  },
  {
    name: "NYC hiring-screening AI",
    context: scenarioFromPreset({
      occupationTitle: "Accountants and Auditors",
      geography: "nyc",
      organizational: {
        hiring_screening_ai: true,
        deployment_strategy: "hybrid",
        retraining_commitment: "selective",
        worker_participation: "medium",
      },
    }),
  },
];

for (const scenario of scenarios) {
  const result = evaluateScenario(scenario.context, rulesPayload.rules);
  console.log(`\n${scenario.name}`);
  console.log(`Matched rules: ${result.matchedRuleCount}`);
  for (const outcome of result.outcomes) {
    console.log(`- ${outcome.dimension}: ${outcome.outlook} (${outcome.score})`);
    console.log(`  rules: ${outcome.ruleIds.join(", ")}`);
  }
}
