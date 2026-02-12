# Implementation Spec: Skill Pipeline Stability - Phase 1

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

Add content-addressed locking to the generation pipeline. Each generated skill's `<!-- generated -->` marker is extended to include a SHA-256 hash of the source doc section content. The generator checks this hash before writing — if it matches, the file is skipped. Refinement upgrades the marker to `<!-- refined:sha256:HASH -->`, which the generator also respects.

The hash is computed from `SkillSpec.content` (the raw doc section markdown). This means the lock breaks when WorkOS updates their docs, which is exactly when regeneration is needed.

Key design decision: hash the **source content**, not the skill output. This way, the same source always produces the same "should I regenerate?" answer, regardless of non-deterministic LLM output.

## File Changes

### New Files

| File Path                      | Purpose                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `scripts/lib/hasher.ts`        | Pure functions for computing and parsing content hashes    |
| `scripts/tests/hasher.spec.ts` | Tests for hash computation, marker parsing, and comparison |

### Modified Files

| File Path                         | Changes                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `scripts/lib/types.ts`            | Add `sourceHash` field to `GeneratedSkill` interface                                                    |
| `scripts/lib/generator.ts`        | Compute source hash from `SkillSpec.content`, include in generated marker                               |
| `scripts/lib/refiner.ts`          | `ensureMarkers()` writes `<!-- refined:sha256:HASH -->` preserving the hash from the scaffold           |
| `scripts/generate.ts`             | Before writing each skill, check existing file for matching hash; skip if unchanged; add `--force` flag |
| `scripts/lib/skill-template.ts`   | Accept `sourceHash` parameter, embed in `<!-- generated:sha256:HASH -->` marker                         |
| `scripts/tests/generator.spec.ts` | Update tests for new marker format                                                                      |

## Implementation Details

### 1. Hasher Module

**Pattern to follow**: `scripts/lib/config.ts` (simple pure-function module)

```typescript
import { createHash } from "crypto";

export function computeSourceHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

// Marker format: <!-- generated:sha256:abc123def456 --> or <!-- refined:sha256:abc123def456 -->
const MARKER_RE = /<!--\s*(generated|refined):sha256:([a-f0-9]+)\s*-->/;

export function parseMarker(fileContent: string): {
  state: "generated" | "refined" | "legacy" | "none";
  hash: string | null;
} {
  const match = fileContent.match(MARKER_RE);
  if (match)
    return { state: match[1] as "generated" | "refined", hash: match[2] };
  if (fileContent.includes("<!-- generated -->"))
    return { state: "legacy", hash: null };
  return { state: "none", hash: null };
}

export function shouldRegenerate(
  existingContent: string,
  newSourceHash: string,
  force: boolean,
): { skip: boolean; reason: string } {
  if (force) return { skip: false, reason: "forced" };
  const marker = parseMarker(existingContent);
  if (marker.state === "none") return { skip: false, reason: "no marker" };
  if (marker.state === "legacy")
    return { skip: false, reason: "legacy marker (no hash)" };
  if (marker.hash === newSourceHash)
    return { skip: true, reason: "source unchanged" };
  return { skip: false, reason: "source changed" };
}
```

**Key decisions**:

- 12-char hex hash (48 bits) — enough for collision avoidance across ~40 skills, human-readable in diffs
- Hash truncation is fine since we're not doing security — just content comparison
- `legacy` state handles existing `<!-- generated -->` markers gracefully (forces regeneration)

### 2. Generator Integration

**Pattern to follow**: existing `generateSkill()` in `scripts/lib/generator.ts`

**Implementation steps**:

1. In `generateSkill()`, compute `sourceHash` from `spec.content` before rendering
2. Pass `sourceHash` to `renderSkill()` in skill-template.ts
3. In `renderSkill()`, emit `<!-- generated:sha256:${sourceHash} -->` instead of `<!-- generated -->`
4. Same for `generateRouter()` and `generateIntegrationRouter()` — hash the rows/content used to build them

### 3. Refiner Marker Handling

**Pattern to follow**: existing `ensureMarkers()` in `scripts/lib/refiner.ts`

**Implementation steps**:

1. In `splitFrontmatter()`, also extract the existing hash from the marker
2. `ensureMarkers()` receives the extracted hash and writes `<!-- refined:sha256:HASH -->` instead of `<!-- generated -->`
3. The hash is preserved from the scaffold — refinement doesn't change the source hash, only the state (`generated` → `refined`)

### 4. Generate.ts Skip Logic

**Pattern to follow**: existing hand-crafted skill skip in `generate.ts`

**Implementation steps**:

1. Parse `--force` flag from CLI args
2. Before writing each skill, read existing file from disk (if it exists)
3. Call `shouldRegenerate(existingContent, newSourceHash, force)`
4. If `skip: true`, log `  ⊘ {skill-name}  (source unchanged)` and skip the write
5. If `skip: false`, log with reason and write normally
6. Track counts: `{written} written, {skipped} skipped, {forced} forced`

### 5. Types Update

Add to `GeneratedSkill` in `types.ts`:

```typescript
export interface GeneratedSkill {
  name: string;
  path: string;
  content: string;
  sizeBytes: number;
  generated: boolean;
  sourceHash?: string; // SHA-256 hash of source doc content
}
```

## Testing Requirements

### Unit Tests

| Test File                         | Coverage                                     |
| --------------------------------- | -------------------------------------------- |
| `scripts/tests/hasher.spec.ts`    | Hash computation, marker parsing, skip logic |
| `scripts/tests/generator.spec.ts` | Updated marker format in generated output    |

**Key test cases**:

- `computeSourceHash` returns consistent hash for same input
- `computeSourceHash` returns different hash for different input
- `parseMarker` handles: `<!-- generated:sha256:abc -->`, `<!-- refined:sha256:abc -->`, `<!-- generated -->` (legacy), no marker
- `shouldRegenerate` returns `skip: true` when hashes match
- `shouldRegenerate` returns `skip: false` for legacy markers (no hash)
- `shouldRegenerate` returns `skip: false` when `force: true` regardless of hash
- `shouldRegenerate` returns `skip: false` when hashes differ (source changed)

### Manual Testing

- [ ] Run `bun run generate` twice — second run should skip all skills
- [ ] Modify a skill's source content hash manually — next generate should detect and regenerate
- [ ] Run `bun run generate -- --force` — should regenerate everything regardless
- [ ] Run refiner on a skill — marker should change from `generated` to `refined` with same hash
- [ ] Run generate after refine — refined skills should be skipped (hash still matches)

## Error Handling

| Error Scenario                                     | Handling Strategy                              |
| -------------------------------------------------- | ---------------------------------------------- |
| Existing file can't be read (permissions, corrupt) | Log warning, treat as "no marker" (regenerate) |
| Hash in marker is malformed                        | Treat as "legacy" (regenerate)                 |
| New skill with no existing file                    | Always generate (no marker to check)           |

## Validation Commands

```bash
# Run all tests
bun test

# Run just hasher tests
bun test scripts/tests/hasher.spec.ts

# Run generate twice and verify idempotency
bun run generate && bun run generate

# Force regenerate
bun run generate -- --force
```

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
