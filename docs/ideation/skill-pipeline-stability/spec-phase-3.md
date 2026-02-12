# Implementation Spec: Skill Pipeline Stability - Phase 3

**Contract**: ./contract.md
**Depends on**: Phase 1 (content hashing & locking)
**Parallel with**: Phase 2 (domain rules)
**Estimated Effort**: S

## Technical Approach

Update all three refiner prompts (feature skill, router skill, API reference skill) to instruct the LLM to only make claims supported by the source documentation and to cite doc URLs for non-obvious claims.

This is the lightest-touch intervention: we're not building provenance infrastructure, just adding clear instructions that reduce hallucinated content at the source. Combined with Phase 2's rules system, this creates a two-layer defense: the refiner tries harder to be accurate, and the quality gate catches what slips through.

## File Changes

### Modified Files

| File Path                | Changes                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `scripts/lib/refiner.ts` | Add attribution instructions to all three `build*RefinePrompt()` functions |

## Implementation Details

### 1. Attribution Instructions

Add the following block to the system prompt of all three refiner prompt builders (`buildRefinePrompt`, `buildRouterRefinePrompt`, `buildApiRefRefinePrompt`):

```
## Source Attribution (CRITICAL)

- ONLY make factual claims that are directly supported by the source documentation provided in the scaffold.
- Do NOT infer, extrapolate, or assume capabilities not explicitly stated in the docs.
- When stating that something is "required", "mandatory", "optional", or "not supported", ensure the source docs explicitly say so.
- For non-obvious claims (e.g., "webhooks are mandatory", "polling is not supported"), include the relevant doc URL as a reference.
- If the source docs are ambiguous about a capability, say "Check the documentation" and provide the URL — do NOT guess.
- NEVER introduce SDK method names, API endpoints, or configuration options that are not in the source docs.
```

**Key decisions**:

- Same attribution block for all three prompt types — factual accuracy applies equally to feature skills, routers, and API references
- "NEVER introduce SDK method names" directly addresses the phantom function issue found in review
- "Do NOT guess" for ambiguous docs is critical — the DSync webhook issue came from the LLM filling in gaps

### 2. Per-Prompt Placement

**Feature skill prompt** (`buildRefinePrompt`): Add after the existing rules list (after rule 11).

**Router skill prompt** (`buildRouterRefinePrompt`): Add after the existing rules list (after rule 8).

**API reference prompt** (`buildApiRefRefinePrompt`): Add after the existing rules list (after rule 10).

### 3. Verification of Effect

After implementing, re-refine `workos-directory-sync` and check:

- Does it still mention webhooks as mandatory? (should: it's in the docs)
- Does it mention polling? (should not: docs don't support it)
- Are doc URLs cited for key claims?

## Testing Requirements

### Unit Tests

No new test files needed. The existing refiner tests don't test prompt content directly (they test the API call mechanism). The attribution instructions are best verified through manual refinement testing.

### Manual Testing

- [ ] Re-refine `workos-directory-sync` — verify no polling claims, webhooks mentioned as mandatory
- [ ] Re-refine `workos-api-vault` — verify decrypt flow is present (it's in the docs) and no phantom methods
- [ ] Re-refine `workos-pipes` — verify no speculative SDK method names
- [ ] Spot-check 2-3 other skills for doc URL citations on non-obvious claims

## Error Handling

No error handling changes needed. This phase only modifies prompt text.

## Validation Commands

```bash
# Run tests (should still pass — no functional changes)
bun test

# Re-refine a single skill and inspect output
bun run scripts/refine-batch.ts workos-directory-sync

# Diff the before/after
git diff skills/workos-directory-sync/SKILL.md
```

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
