# Evidence Codebook

The evidence matrix translates research sources into scenario rules. Each row should capture one specific claim, not an entire article.

The working file lives at:

```text
data/raw/literature/evidence_matrix.csv
```

## Workflow

1. Read a source.
2. Highlight a claim that connects an institutional or organizational condition to a labor-market outcome.
3. Add one row to the evidence matrix for that claim.
4. Code the row by mechanism, outcome, geography, direction, and confidence.
5. Later, convert coded rows into scenario rules and narrative explanations.

For a faster first pass, run:

```text
python3 scripts/build_evidence_candidates.py
```

This creates:

```text
data/interim/evidence_candidates.csv
```

The candidates file is a review queue, not the final evidence matrix. Keep useful rows, rewrite the claims in your own concise wording, and then move them into `data/raw/literature/evidence_matrix.csv`.

If the candidate file is too large, run:

```text
python3 scripts/filter_evidence_candidates.py
```

This creates:

```text
data/interim/evidence_candidates_priority.csv
```

The pipeline is:

```text
literature + datasets
  -> coded evidence matrix
  -> scenario rules
  -> interactive explorer outputs
```

The scenario-rule layer is documented in:

```text
docs/scenario-rules-codebook.md
```

## Columns

```text
source_id
citation
source_type
evidence_type
source_file
page_ref
institutional_dimension
organizational_mechanism
outcome_dimension
geography
claim_summary
evidence_excerpt
direction
confidence
verification_status
notes
```

## Column Definitions

```text
source_id
Short stable ID for the source, such as acemoglu_johnson_2023.

citation
Full or short citation.

source_type
Academic article, working paper, policy report, dataset, government document, historical case, etc.

evidence_type
Theory, quantitative baseline, qualitative finding, comparative case, historical precedent, policy description, or empirical association.

source_file
Relative path to the source file or extracted text file.

page_ref
Page number or page range when available. Use blank if not yet verified.

institutional_dimension
The institutional variable involved, such as AI governance, workforce development, collective bargaining, social protection, employment protection, public investment, or employer retraining incentives. Use `not_applicable` when the row is about baseline exposure or organizational/work-design logic rather than an institutional variable.

organizational_mechanism
The firm/workplace mechanism involved, such as automation-first deployment, augmentation, retraining, worker participation, job redesign, preservation of junior work, or skill investment. Use `not_applicable` when the row is about a baseline, policy context, or institutional condition rather than a firm/workplace mechanism.

outcome_dimension
The labor outcome affected: employment, wages, mobility, productivity, redeployment, displacement, skill accumulation, or distribution of gains.

geography
General, United States, NYC, Denmark, Singapore, OECD, etc.

claim_summary
One concise sentence describing the claim.

evidence_excerpt
A short source excerpt or paraphrased snippet used to verify the row. Keep this concise.

direction
improves, worsens, mixed, increases_risk, decreases_risk, or contextual.

confidence
limited, moderate, or stronger.

verification_status
draft, excerpt_verified, page_verified, or needs_review.

notes
Page number, quote fragment, caveat, or link to source file.
```

## Confidence Levels

```text
stronger  -> multiple relevant sources or well-established comparative evidence
moderate  -> one strong source or several indirectly related sources
limited   -> plausible but partial, indirect, or emerging evidence
```

## Coding Rule

If a source makes three useful claims, create three rows. This will feel repetitive, but it makes the scenario logic much easier to trace later.
