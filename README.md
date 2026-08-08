# Institutional Scenario Explorer for AI & Labor Futures

**Same AI exposure. Different institutional arrangements. Different labor futures.**

An interactive scenario explorer for examining how institutional arrangements and organizational choices can shape different labor pathways under similar conditions of AI exposure.

**Live project:** https://boryanata.github.io/futureofwork-scenario-explorer/

## Research question

**How do institutional arrangements shape divergent labor futures under conditions of AI exposure?**

The project starts from a simple premise: technological exposure does not determine labor outcomes on its own. Similar levels of AI exposure can travel through different institutional and organizational pathways, producing different pressures around work design, displacement, redeployment, skill formation, job quality, employment, and the distribution of gains.

The explorer is therefore designed for **comparison, not prediction**.

## How the explorer works

The interaction follows a causal sequence:

**AI exposure baseline → Institutional environment → Organizational response → Human–AI work design → Labor outcome tendencies**

Users can:

1. choose an occupation and view its AI-exposure baseline;
2. start with an institutional arrangement and modify its component dimensions;
3. explore how an employer might deploy AI, invest in workers, and involve workers in redesign;
4. examine a scenario-informed human–AI work design and rearrange tasks across human-led, human + AI, and AI-led modes;
5. compare directional labor outcome tendencies;
6. save one scenario and compare it with another pathway under the same technological exposure;
7. optionally compare the user's institutional arrangement with stylized reference cases.

## Institutional arrangements

The explorer treats institutional arrangements as configurations rather than single policies or organizations. The active scenario combines dimensions such as:

- AI governance
- algorithmic transparency
- worker information rights
- data protection
- anti-discrimination rules
- collective bargaining
- workforce development
- employer retraining incentives
- active labor-market policy
- social protection
- employment protection

Three analytical starting configurations are provided:

- **Industry-led adaptation**
- **Publicly coordinated adaptation**
- **Worker-negotiated adaptation**

These are starting points for exploration, not fixed country models or normative rankings. Users can modify the underlying dimensions to construct different arrangements.

## Organizational response and work design

Institutional conditions shape what is feasible, costly, protected, or negotiable, but they do not mechanically determine what organizations do.

The explorer therefore treats organizational response as a distinct layer. Users can vary choices such as deployment strategy, retraining and role transition, and worker participation in work redesign.

The **Work Design Studio** then translates the scenario into one possible organization of occupation-specific tasks across three modes:

- **Human-led**
- **Human + AI**
- **AI-led**

The initial task arrangement is scenario-informed and illustrative. It is not an empirical estimate of the percentage of work that will be automated. Users can rearrange tasks to explore alternative ways the occupation could be organized.

## Labor outcome tendencies

The model does not collapse outcomes into a single score. A scenario may move productivity, displacement pressure, skill formation, job quality, employment, redeployment capacity, and the distribution of gains in different directions at the same time.

Outcome positions are **evidence-informed qualitative tendencies synthesized from rule-based scenario logic**. They are not measured effect sizes or forecasts of individual job outcomes.

## Data foundation

The current interactive app uses:

- **O*NET** occupational, task, and skill data;
- **OECD** AI-exposure data;
- the **Anthropic Economic Index**.

These quantitative inputs establish the occupational and technological baseline used by the explorer.

Academic and policy evidence is coded separately and used to inform the scenario rules linking institutional arrangements and organizational choices to labor-market tendencies.

The repository also contains additional raw and research materials used in the broader capstone workflow. Their presence in `data/raw/` does not necessarily mean they are active inputs to the current interactive model.

## Comparative reference cases

The explorer includes three comparative institutional references:

- **United States / NYC**
- **Singapore**
- **Denmark**

The cases are intentionally secondary to the user's active scenario. They allow users to compare the institutional fingerprint they constructed with stylized empirical reference configurations.

> **Cases are stylized representations of selected institutional features, not comprehensive models of each labor market.**

They should not be read as country rankings, predictions, or exact national models.

## Evidence and transparency

The scenario engine is rule-based rather than predictive. Rules connect combinations of institutional and organizational conditions to directional labor-outcome tendencies and point back to coded academic or policy evidence.

The **Explore evidence base** section in the app surfaces the claims and sources associated with the active scenario.

The design intentionally separates:

- quantitative exposure and occupational baselines;
- institutional and organizational scenario choices;
- work-design exploration;
- directional outcome tendencies;
- supporting evidence.

This separation is meant to avoid treating AI exposure as synonymous with job loss or presenting institutional choices as deterministic.

## Methodological limits

The explorer is a structured scenario tool, not a forecasting model.

In particular:

- AI exposure is treated as a baseline condition, not a prediction of displacement.
- Institutional configurations are analytical constructions.
- Organizational responses are scenario choices, not observed firm behavior.
- Work Design Studio task placements are illustrative and can be rearranged by the user.
- Outcome movements are qualitative directional tendencies produced by the rule set.
- Comparative cases are stylized representations of selected institutional dimensions.
- The tool does not estimate causal effect sizes or predict outcomes for individual workers, firms, or occupations.

## Repository structure

```text
futureofwork-scenario-explorer/
├── data/              # Raw, interim, and processed research/data assets
├── docs/              # Method, data-source, and evidence documentation
├── scripts/           # Data preparation and transformation scripts
├── src/
│   ├── App.tsx        # Main interactive explorer
│   ├── data/          # App-ready data
│   ├── domain/        # Scenario engine, types, and explanation logic
│   ├── styles/        # Interface styles
│   └── main.tsx
├── PROJECT_STRUCTURE.md
├── README.md
├── package.json
└── vite.config.ts
```

For more detailed implementation notes, see `PROJECT_STRUCTURE.md` and the files under `docs/`.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Project context

This repository supports a graduate capstone project examining how institutional arrangements mediate labor-market adaptation under AI exposure. The digital artifact combines data visualization, comparative institutional analysis, policy evidence, and scenario-based exploration.

The central claim is not that one institutional pathway guarantees a particular outcome. It is that **the consequences of technological change depend partly on the institutions and organizational choices through which that change is absorbed.**
