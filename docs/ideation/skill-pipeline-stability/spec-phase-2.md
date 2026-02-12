# Implementation Spec: Skill Pipeline Stability - Phase 2

**Contract**: ./contract.md
**Depends on**: Phase 1 (content hashing & locking)
**Estimated Effort**: M

## Technical Approach

Add a per-skill domain rules system. Each skill can have a `.rules.yml` file alongside its SKILL.md that encodes factual constraints domain experts care about. The quality gate reads these rules and checks the refined skill content against them.

Rules use two mechanisms:

1. **`must_contain`** — patterns that MUST appear in the skill (e.g., "webhooks are mandatory")
2. **`must_not_contain`** — patterns that must NOT appear (e.g., "polling for directory events")

Each rule has a severity: `warn` (soft, logged in report) or `error` (hard, blocks writing once promoted). All rules start as `warn`. A `promoted: true` flag upgrades a rule to `error`.

The quality gate is extended to load `.rules.yml`, evaluate rules against skill content, and report violations. Violations are included in the JSON quality report for tracking.

## File Changes

### New Files

| File Path                                 | Purpose                                     |
| ----------------------------------------- | ------------------------------------------- |
| `scripts/lib/rules.ts`                    | Rule loading, parsing, and evaluation logic |
| `scripts/tests/rules.spec.ts`             | Tests for rule loading and evaluation       |
| `skills/workos-directory-sync/.rules.yml` | First real rule: webhooks are mandatory     |

### Modified Files

| File Path                     | Changes                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `scripts/lib/types.ts`        | Add `SkillRule`, `RuleResult`, and `QualityResult.ruleViolations` types |
| `scripts/lib/quality-gate.ts` | Load and evaluate per-skill rules, include violations in report         |
| `scripts/generate.ts`         | Pass rule violations through to output logging                          |

## Implementation Details

### 1. Rule File Format

**Location**: `skills/{skill-name}/.rules.yml`

```yaml
# skills/workos-directory-sync/.rules.yml
rules:
  - id: dsync-webhooks-mandatory
    description: "Directory Sync requires webhooks — polling is not supported"
    severity: warn # warn | error
    promoted: false # set to true once proven reliable
    must_contain:
      - pattern: "webhook"
        context: "Must mention webhooks as the event delivery mechanism"
      - pattern: "mandatory|required"
        context: "Must state that webhooks are mandatory, not optional"
    must_not_contain:
      - pattern: "poll(ing)? for (directory |sync )?events"
        context: "Polling is not supported for Directory Sync events"
```

**Key decisions**:

- YAML over JSON — more readable for domain experts, supports comments
- Patterns are regex — flexible enough for natural language variation ("mandatory" OR "required")
- `context` field explains WHY the rule exists — helps the refiner prompt and human reviewers
- `promoted` field controls graduated enforcement — starts false (warn), set true to upgrade to error

### 2. Rules Module

**Pattern to follow**: `scripts/lib/quality-gate.ts` (scoring function that takes skill content)

```typescript
import { parse } from "yaml";

export interface SkillRule {
  id: string;
  description: string;
  severity: "warn" | "error";
  promoted: boolean;
  must_contain?: Array<{ pattern: string; context: string }>;
  must_not_contain?: Array<{ pattern: string; context: string }>;
}

export interface RuleViolation {
  ruleId: string;
  description: string;
  severity: "warn" | "error";
  type: "missing" | "forbidden";
  pattern: string;
  context: string;
}

export function loadRules(skillName: string): SkillRule[];
export function evaluateRules(
  skillContent: string,
  rules: SkillRule[],
): RuleViolation[];
```

**Implementation steps**:

1. `loadRules()` reads `skills/{name}/.rules.yml`, parses YAML, returns `SkillRule[]`. Returns empty array if no file exists.
2. `evaluateRules()` iterates rules:
   - For each `must_contain` pattern: regex search in content. If not found → `missing` violation
   - For each `must_not_contain` pattern: regex search in content. If found → `forbidden` violation
   - Effective severity: if `promoted: true`, use rule's severity. If `promoted: false`, always `warn`.
3. Return array of violations (empty = all rules pass)

### 3. Quality Gate Extension

**Pattern to follow**: existing `scoreSkill()` in `quality-gate.ts`

**Implementation steps**:

1. After computing the numeric score, call `loadRules(skill.name)` and `evaluateRules(skill.content, rules)`
2. Add violations to the quality result
3. In the console output, append rule violations:
   ```
   ✓ workos-directory-sync  95/100
     ⚠ RULE dsync-webhooks-mandatory: Missing pattern "mandatory|required" (warn)
   ```
4. For `error`-severity violations on promoted rules, mark the skill as failed (exit code 1)
5. Add violations to the JSON quality report

### 4. First Rule: Directory Sync Webhooks

```yaml
# skills/workos-directory-sync/.rules.yml
rules:
  - id: dsync-webhooks-mandatory
    description: "Directory Sync requires webhooks — polling is not supported"
    severity: warn
    promoted: false
    must_contain:
      - pattern: "webhook"
        context: "Must mention webhooks as the event delivery mechanism"
    must_not_contain:
      - pattern: "poll(ing)? for.*(directory|sync|dsync).*event"
        context: "Polling is not supported for Directory Sync events"
      - pattern: "optional.*(webhook|event delivery)"
        context: "Webhooks are mandatory, not optional"
```

### 5. Feeding Rules into Refinement

The refiner already gets a per-skill prompt. Extend it to include rule context so the LLM knows the constraints before generating:

In `buildRefinePrompt()`, if the skill has rules, append:

```
## Domain Constraints (MUST respect)

The following rules are enforced during quality validation. Your output MUST satisfy them:

- dsync-webhooks-mandatory: Directory Sync requires webhooks — polling is not supported.
  MUST mention: webhooks
  MUST NOT claim: polling for directory events
```

This creates a feedback loop: rules → refiner prompt → refined content → rules validation.

## Testing Requirements

### Unit Tests

| Test File                     | Coverage                                       |
| ----------------------------- | ---------------------------------------------- |
| `scripts/tests/rules.spec.ts` | Rule loading, pattern matching, severity logic |

**Key test cases**:

- `loadRules()` returns empty array when no `.rules.yml` exists
- `loadRules()` parses valid YAML and returns typed rules
- `evaluateRules()` detects missing `must_contain` pattern
- `evaluateRules()` detects present `must_not_contain` pattern
- `evaluateRules()` passes when all rules are satisfied
- Promoted rules use their specified severity; non-promoted rules always `warn`
- Regex patterns work with case-insensitive matching
- Multiple rules for the same skill are all evaluated

### Manual Testing

- [ ] Run quality gate on directory-sync — should show rule evaluation output
- [ ] Intentionally violate a rule — should see warning in output
- [ ] Promote a rule to `error` + `promoted: true` — should fail the quality gate
- [ ] Run refiner on directory-sync — check that rule context appears in refiner prompt

## Error Handling

| Error Scenario                 | Handling Strategy                                                          |
| ------------------------------ | -------------------------------------------------------------------------- |
| Malformed YAML in `.rules.yml` | Log error with file path, skip rules for that skill (don't block pipeline) |
| Invalid regex pattern          | Log error with rule ID, skip that specific rule                            |
| Rule file exists but is empty  | Treat as no rules (empty array)                                            |

## Validation Commands

```bash
# Run all tests
bun test

# Run just rules tests
bun test scripts/tests/rules.spec.ts

# Run quality gate and check for rule output
bun run generate

# Verify DSync rule catches violations (manually edit skill to violate, then run)
```

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
