# Skill Pipeline Stability Contract

**Created**: 2026-02-09
**Confidence Score**: 95/100
**Status**: Approved

## Problem Statement

The skill generation pipeline (`bun run generate`, `bun run scripts/refine-batch.ts`) is destructive-by-default. Every run overwrites all generated SKILL.md files, including ones that were previously refined and expert-reviewed. This has two consequences:

1. **Instability** — Refined skills get clobbered by raw scaffolds on the next `generate` run. Refinement is non-deterministic, so re-refining produces different (not necessarily better) output. There is no concept of "approved" state.

2. **Factual errors** — The refiner (LLM) introduces claims not supported by the source docs. Example: Directory Sync skill implied polling is an option when webhooks are mandatory. There is no mechanism to encode domain constraints, trace claim provenance, or validate correctness against known rules.

The pipeline maintainer (1 person) currently manages this by manually `git checkout`-ing clobbered files. Domain experts who review skills have no way to encode their feedback as durable constraints.

## Goals

1. **Content-addressed locking** — `generate` skips skills whose source docs haven't changed. Skills become stable after refinement. Source doc changes break the lock and flag the skill for re-generation.

2. **Domain rules system** — Encode per-skill factual constraints (e.g., "webhooks mandatory for DSync") in reviewable YAML files. Rules are checked during the quality gate. Graduated enforcement: warnings initially, hard gates once proven.

3. **Attribution in refinement** — Refiner prompt instructs the LLM to only make claims supported by source docs and cite doc URLs for non-obvious claims. Reduces hallucinated content.

4. **Graduated enforcement** — Rule violations start as warnings in the quality report. Once a rule has zero false positives across 3+ runs, it can be promoted to a hard gate that blocks writing.

## Success Criteria

- [ ] `bun run generate` skips SKILL.md files with matching source hash (no file write, logged as "unchanged")
- [ ] `bun run generate` regenerates skills whose source hash has changed (logged as "source changed, regenerating")
- [ ] `bun run generate --force` bypasses locking and regenerates everything
- [ ] `<!-- refined:sha256:HASH -->` marker embedded in refined skills with source content hash
- [ ] Per-skill `.rules.yml` files checked during quality gate (at least 1 rule for DSync as proof)
- [ ] Quality report includes rule violation warnings with skill name, rule name, and severity
- [ ] Refiner prompt includes attribution instruction ("cite doc URLs for non-obvious claims")
- [ ] Existing tests continue to pass after all changes
- [ ] `bun run generate && bun run generate` is idempotent (second run writes zero files)

## Scope Boundaries

### In Scope

- Content-addressed locking via source hash in marker comments
- Per-skill `.rules.yml` files with rule definitions
- Quality gate extension to check rules
- Refiner prompt update for attribution
- Graduated enforcement (soft warnings with promotion path)
- `--force` flag for overriding locks

### Out of Scope

- Full provenance tracking (mapping every sentence to a source paragraph) — too complex for v1
- Automated rule generation from docs — rules are hand-authored by domain experts
- UI for viewing quality reports — CLI output is sufficient
- Diff review mode (showing refiner changes for human approval) — deferred to future
- Changes to hand-crafted skills — they are already protected by HAND_CRAFTED_SKILLS list

### Future Considerations

- Diff review mode: after refinement, show what changed vs previous version for human approval
- Auto-rule suggestions: analyze docs to suggest rules ("this section says X is mandatory")
- Quality report dashboard: web view of quality scores and rule violations over time
- Rule testing: a way to run rules against existing skills without regenerating
