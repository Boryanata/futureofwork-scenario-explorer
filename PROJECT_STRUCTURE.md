# Scenario Explorer Project Structure

This project should be organized around the causal/theoretical chain:

AI exposure -> institutional arrangements -> organizational decisions -> human-AI work design -> labor market outcomes

The app should not present itself as predictive. It should present scenario outputs as evidence-informed, rule-based comparisons under a held-constant AI exposure baseline.

## Recommended App Shape

Use a small TypeScript web app with a data-first core:

```text
scenario-explorer/
  README.md
  PROJECT_STRUCTURE.md
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx
    App.tsx
    styles/
      globals.css
    domain/
      types.ts
      scenarioEngine.ts
      scoring.ts
      explanations.ts
    data/
      occupations.json
      exposure-baselines.json
      institutional-dimensions.json
      organizational-dimensions.json
      evidence-matrix.json
      geographies.json
    features/
      baseline/
        BaselineSelector.tsx
        ExposureSummary.tsx
      institutions/
        InstitutionalControls.tsx
      organizations/
        OrganizationalControls.tsx
      scenarios/
        ScenarioBuilder.tsx
        ScenarioNarrative.tsx
        OutcomeComparison.tsx
      evidence/
        EvidencePanel.tsx
    components/
      Layout.tsx
      Tabs.tsx
      Slider.tsx
      SegmentedControl.tsx
      OutcomeBadge.tsx
    utils/
      formatters.ts
  docs/
    conceptual-framework.md
    evidence-method.md
    data-sources.md
```

## Core Data Model

The domain model should keep baseline exposure separate from choices that mediate outcomes.

```ts
type ExposureBaseline = {
  occupation: string;
  socCode?: string;
  sector: string;
  naicsCode?: string;
  exposureLevel: "low" | "medium" | "high";
  exposureSources: string[];
};

type InstitutionalArrangement = {
  aiGovernance: "public_interest" | "co_governed" | "industry_led";
  workforceDevelopment: "weak" | "moderate" | "strong";
  employerRetrainingIncentives: "low" | "medium" | "high";
  collectiveBargaining: "weak" | "moderate" | "strong";
  socialProtection: "minimal" | "moderate" | "strong";
};

type OrganizationalDecision = {
  deploymentStrategy: "automation_first" | "augmentation" | "hybrid";
  retrainingCommitment: "none" | "selective" | "broad";
  juniorWorkPreservation: "low" | "medium" | "high";
  workerParticipation: "low" | "medium" | "high";
  skillInvestmentHorizon: "short" | "medium" | "long";
};

type Outcome = {
  dimension:
    | "employment"
    | "wages"
    | "mobility"
    | "productivity"
    | "redeployment"
    | "displacement"
    | "skillAccumulation";
  direction: "improves" | "worsens" | "mixed";
  confidence: "limited" | "moderate" | "stronger";
  explanation: string;
  evidenceIds: string[];
};
```

## Why This Structure Fits The Capstone

`domain/` contains the analytical logic. This is where the project makes its argument: institutions and organizational decisions mediate the relationship between AI exposure and labor outcomes.

`data/` contains research-backed configuration. This lets the tool remain transparent: every scenario output can point back to an evidence row instead of pretending to be a statistical forecast.

`features/` mirrors the user flow:

1. Select occupation
2. View AI exposure
3. Configure institutional arrangements
4. Configure organizational decisions
5. Generate scenario
6. Compare labor outcomes

`docs/` connects the app to the written capstone. These files should explain methodology, evidence limits, and why the explorer uses scenarios rather than prediction.

## MVP Scope

The first usable version should include:

1. A baseline selector with a few sample occupations.
2. Fixed AI exposure labels from a local JSON file.
3. Institutional controls for governance, workforce development, retraining incentives, collective bargaining, and social protection.
4. Organizational controls for automation/augmentation strategy, retraining, junior work preservation, worker participation, and skill horizon.
5. A rule-based scenario engine that outputs direction, confidence, and explanation.
6. A comparison view for two scenarios under the same exposure baseline.
7. An evidence panel showing which literature supports each output.

## Important Framing Rules

The UI should avoid claims like "AI will reduce employment by X%."

Use language like:

- "This scenario is associated with higher displacement risk."
- "The evidence base suggests mixed wage effects."
- "Strong workforce development and broad retraining improve redeployment capacity."
- "This is an evidence-informed scenario, not a forecast."

The tool's intellectual contribution is not prediction. It is comparison: showing how similar AI exposure can lead to different labor-market futures depending on institutional and organizational mediation.
