# Implementation Spec: WorkOS Skills Generator - Phase 2

**Contract**: ./contract.md
**Estimated Effort**: L

## Technical Approach

Phase 2 is the core: build the splitter, skill generator, router skill, and feature skills. The splitter applies per-section strategies from config to decide how each of the 24 sections becomes skills. The generator transforms section content into AI-drafted SKILL.md files with frontmatter, decision trees, verification checklists, error recovery, and doc URL references.

The router skill is a special hand-authored-style skill that acts as a dispatcher — it knows the full topic map and directs the agent to load the right skill. The integration router is a single skill with a provider lookup table.

Feature skills are AI-drafted using `llms-full.txt` section content as context, but structured to match the quality bar of the existing AuthKit skills. The key principle: skills encode procedural knowledge and reference doc URLs for runtime WebFetch — they don't paste documentation content.

## File Changes

### New Files

| File Path                                    | Purpose                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `scripts/lib/splitter.ts`                    | Apply split strategies per section (single, per-subsection, per-feature)            |
| `scripts/lib/generator.ts`                   | Transform section data → SKILL.md with frontmatter + structured content             |
| `scripts/lib/skill-template.ts`              | Template functions for generating skill sections (decision trees, checklists, etc.) |
| `scripts/tests/splitter.test.ts`             | Unit tests for splitter                                                             |
| `scripts/tests/generator.test.ts`            | Unit tests for generator                                                            |
| `skills/workos-router/SKILL.md`              | Router skill: topic index → skill dispatch                                          |
| `skills/workos-integrations/SKILL.md`        | Integration router: provider lookup table                                           |
| `skills/workos-sso/SKILL.md`                 | Generated: SSO feature skill                                                        |
| `skills/workos-directory-sync/SKILL.md`      | Generated: Directory Sync feature skill                                             |
| `skills/workos-rbac/SKILL.md`                | Generated: RBAC feature skill                                                       |
| `skills/workos-fga/SKILL.md`                 | Generated: Fine-Grained Authorization skill                                         |
| `skills/workos-vault/SKILL.md`               | Generated: Vault feature skill                                                      |
| `skills/workos-widgets/SKILL.md`             | Generated: Widgets feature skill                                                    |
| `skills/workos-events/SKILL.md`              | Generated: Events feature skill                                                     |
| `skills/workos-audit-logs/SKILL.md`          | Generated: Audit Logs feature skill                                                 |
| `skills/workos-admin-portal/SKILL.md`        | Generated: Admin Portal feature skill                                               |
| `skills/workos-mfa/SKILL.md`                 | Generated: Multi-Factor Auth skill                                                  |
| `skills/workos-magic-link/SKILL.md`          | Generated: Magic Link skill                                                         |
| `skills/workos-feature-flags/SKILL.md`       | Generated: Feature Flags skill                                                      |
| `skills/workos-domain-verification/SKILL.md` | Generated: Domain Verification skill                                                |
| `skills/workos-custom-domains/SKILL.md`      | Generated: Custom Domains skill                                                     |
| `skills/workos-email/SKILL.md`               | Generated: Email delivery skill                                                     |
| `skills/workos-pipes/SKILL.md`               | Generated: Pipes feature skill                                                      |
| `skills/workos-migrate-auth0/SKILL.md`       | Generated: Auth0 migration skill                                                    |
| `skills/workos-migrate-firebase/SKILL.md`    | Generated: Firebase Auth migration skill                                            |
| `skills/workos-migrate-cognito/SKILL.md`     | Generated: AWS Cognito migration skill                                              |

### Modified Files

| File Path               | Changes                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `scripts/generate.ts`   | Add splitter → generator → write pipeline after parse/validate |
| `scripts/lib/config.ts` | Add split strategies and skill metadata for each section       |

## Implementation Details

### Splitter

**Overview**: Takes parsed section tree and applies per-section split strategies to produce `SkillSpec[]`.

```typescript
interface SkillSpec {
  name: string; // "workos-sso"
  description: string; // Action-oriented 1-liner
  title: string; // "WorkOS Single Sign-On"
  anchor: string; // Source section anchor
  content: string; // Raw section content (for AI drafting context)
  docUrls: string[]; // URLs from llms.txt for this topic
  generated: boolean; // true for generated, false for hand-crafted
}

type SplitStrategy =
  | { strategy: "single" }
  | { strategy: "per-subsection"; groupChildren?: boolean }
  | { strategy: "per-feature"; features: string[] }
  | { strategy: "skip" };

function splitSections(
  sections: Section[],
  llmsTxtUrls: Map<string, string[]>,
  config: Record<string, SplitStrategy>,
): SkillSpec[];
```

**Key decisions**:

- `single`: entire section → one skill (most sections)
- `per-subsection`: split at `### Heading` boundaries (integrations, migrate)
- `per-feature`: split by named feature groups mapped from config (authkit)
- `skip`: don't generate (postman, glossary — low value as skills)
- `llmsTxtUrls`: parsed from `llms.txt`, maps section anchor → array of doc page URLs

**Implementation steps**:

1. Parse `llms.txt` to extract URL map (anchor → URLs[])
2. For each section, look up split strategy from config
3. Apply strategy to produce `SkillSpec[]`
4. For `per-subsection`, group child `###` headings that are FAQ-style under their parent
5. Attach relevant doc URLs to each spec
6. Skip hand-crafted skill names (workos-authkit-\*) to avoid conflicts

### Config

**Overview**: Defines split strategy and metadata for each section.

```typescript
const SECTION_CONFIG: Record<string, { split: SplitStrategy; skip?: boolean }> =
  {
    postman: { split: { strategy: "single" }, skip: true },
    "on-prem-deployment": { split: { strategy: "single" }, skip: true },
    glossary: { split: { strategy: "single" }, skip: true },
    email: { split: { strategy: "single" } },
    widgets: { split: { strategy: "single" } },
    vault: { split: { strategy: "single" } },
    sso: { split: { strategy: "single" } },
    sdks: { split: { strategy: "single" }, skip: true },
    reference: { split: { strategy: "skip" } }, // Phase 3
    rbac: { split: { strategy: "single" } },
    pipes: { split: { strategy: "single" } },
    migrate: { split: { strategy: "per-subsection" } },
    mfa: { split: { strategy: "single" } },
    "magic-link": { split: { strategy: "single" } },
    integrations: { split: { strategy: "single" } }, // Single router, not per-provider
    fga: { split: { strategy: "single" } },
    "feature-flags": { split: { strategy: "single" } },
    events: { split: { strategy: "single" } },
    "domain-verification": { split: { strategy: "single" } },
    "directory-sync": { split: { strategy: "single" } },
    "custom-domains": { split: { strategy: "single" } },
    authkit: { split: { strategy: "skip" } }, // Covered by CLI skills + router
    "audit-logs": { split: { strategy: "single" } },
    "admin-portal": { split: { strategy: "single" } },
  };
```

### Generator

**Overview**: Transforms `SkillSpec` into a SKILL.md file. This is where the AI-drafting happens — the generator uses the section content as context to produce structured, actionable skill content.

```typescript
interface GeneratedSkill {
  name: string;
  path: string; // "skills/workos-sso/SKILL.md"
  content: string; // Full SKILL.md content
  sizeBytes: number;
  generated: boolean;
}

function generateSkill(spec: SkillSpec): GeneratedSkill;
function generateRouter(
  specs: SkillSpec[],
  llmsTxtContent: string,
): GeneratedSkill;
function generateIntegrationRouter(
  integrationsSection: Section,
  llmsTxtUrls: Map<string, string[]>,
): GeneratedSkill;
```

**Key decisions**:

- Skills follow the AuthKit skill pattern: frontmatter → doc fetch step → decision tree → implementation steps → verification → error recovery
- `<!-- generated -->` marker in every generated skill (first line after frontmatter)
- Doc URLs are embedded as WebFetch references, not as content
- The generator structures content around _procedural knowledge_ extracted from the docs, not raw documentation text

**Skill structure template**:

```markdown
---
name: workos-{name}
description: { Action-oriented description }
---

<!-- generated -->

# {Title}

## Step 1: Fetch Documentation

WebFetch the relevant docs for latest implementation details:
{list of doc URLs from llms.txt}

## When to Use

{Brief decision guide: when this feature is the right choice}

## Prerequisites

{What must be in place before starting}

## Implementation Guide

{Decision trees, step-by-step flow extracted from docs content}

## Verification Checklist

{Concrete checks to confirm implementation works}

## Error Recovery

{Common errors and fixes, extracted from docs}

## Related Skills

{Cross-references to other WorkOS skills}
```

**Implementation steps**:

1. Generate frontmatter from `SkillSpec.name` and `SkillSpec.description`
2. Add `<!-- generated -->` marker
3. Build "Fetch Documentation" section from `docUrls`
4. Extract "When to Use" from section intro/overview content
5. Extract decision trees from section content (look for conditional patterns, configuration choices)
6. Build verification checklist from section's testing/validation content
7. Extract error patterns from section content
8. Add related skill cross-references based on section relationships

### Router Skill

**Overview**: The master dispatcher. Knows all available skills and routes based on user intent.

```markdown
---
name: workos-router
description: Route WorkOS requests to the right skill. Load this first for any WorkOS task.
---

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult this table to load the right skill.

## Topic → Skill Map

| User wants to...           | Load skill            | Doc reference                       |
| -------------------------- | --------------------- | ----------------------------------- |
| Install AuthKit in Next.js | workos-authkit-nextjs | workos.com/docs/sdks/authkit-nextjs |
| Install AuthKit in React   | workos-authkit-react  | workos.com/docs/sdks/authkit-react  |
| Configure SSO              | workos-sso            | workos.com/docs/sso                 |
| Set up Directory Sync      | workos-directory-sync | workos.com/docs/directory-sync      |
| ...                        | ...                   | ...                                 |

## If No Skill Matches

WebFetch the full docs index: https://workos.com/docs/llms.txt
Then WebFetch the specific section URL for the user's topic.

## AuthKit Installation Detection

If the user wants to install AuthKit, detect their framework:

- `next.config.*` → workos-authkit-nextjs
- `vite.config.*` + react → workos-authkit-react
- `react-router` in deps → workos-authkit-react-router
- `@tanstack/start` in deps → workos-authkit-tanstack-start
- No framework detected → workos-authkit-vanilla-js
```

**Implementation steps**:

1. Build topic map from all generated `SkillSpec` names + doc URLs
2. Include hand-crafted AuthKit skills in the map
3. Add framework detection logic for AuthKit installation routing
4. Add fallback: WebFetch `llms.txt` if no skill matches

### Integration Router Skill

**Overview**: Single skill with a provider lookup table instead of 60 individual files.

```markdown
---
name: workos-integrations
description: Set up identity provider integrations with WorkOS. Covers SSO, SCIM, and OAuth for 40+ providers.
---

# WorkOS Integrations

## Provider Lookup

| Provider         | Type       | Doc URL                                  |
| ---------------- | ---------- | ---------------------------------------- |
| Okta             | SAML, SCIM | workos.com/docs/integrations/okta-saml   |
| Azure AD         | SAML, SCIM | workos.com/docs/integrations/azure-ad    |
| Google Workspace | SAML, SCIM | workos.com/docs/integrations/google-saml |
| ...              | ...        | ...                                      |

## General Integration Flow

1. WebFetch the provider-specific doc URL from the table above
2. Follow the setup steps in the docs
3. Verify with test SSO flow

## Common Integration Patterns

### SAML Setup (most providers)

{Decision tree for SAML configuration}

### SCIM Directory Setup

{Decision tree for directory integration}

### OAuth Setup

{Decision tree for OAuth providers}
```

**Implementation steps**:

1. Parse integrations section to extract provider names and types
2. Map provider names to doc URLs from `llms.txt`
3. Build lookup table
4. Extract common patterns across integration types
5. Generate decision trees for SAML, SCIM, OAuth setup flows

## Testing Requirements

### Unit Tests

| Test File                         | Coverage                                                      |
| --------------------------------- | ------------------------------------------------------------- |
| `scripts/tests/splitter.test.ts`  | Strategy application, subsection grouping, conflict avoidance |
| `scripts/tests/generator.test.ts` | Frontmatter generation, template structure, marker presence   |

**Key test cases**:

- Splitter applies 'single' strategy correctly
- Splitter skips sections marked `skip: true`
- Splitter avoids generating skills that conflict with hand-crafted names
- Generator produces valid YAML frontmatter
- Generator includes `<!-- generated -->` marker
- Generator includes doc URL references
- Router includes all generated skill names
- Integration router covers all providers

### Manual Testing

- [ ] `bun run scripts/generate.ts` produces ~20-25 skills in `skills/`
- [ ] Router skill lists all available skills
- [ ] Each generated skill has WebFetch doc references (not baked-in content)
- [ ] Integration router has provider lookup table with correct URLs
- [ ] No generated skill overwrites hand-crafted AuthKit skills

## Error Handling

| Error Scenario                                   | Handling Strategy                                               |
| ------------------------------------------------ | --------------------------------------------------------------- |
| Section content too short for meaningful skill   | Log warning, generate minimal skill with doc URL reference only |
| Doc URL not found in llms.txt for a section      | Use section anchor to construct URL: `workos.com/docs/{anchor}` |
| Generated skill name conflicts with hand-crafted | Skip generation, log info message                               |
| Skill content exceeds 50KB                       | Log warning, truncate non-essential sections                    |

## Validation Commands

```bash
# Tests
bun test

# Generate all skills
bun run scripts/generate.ts

# Verify skill count
ls skills/*/SKILL.md | wc -l

# Check no skill exceeds 50KB
find skills -name "SKILL.md" -size +50k

# Verify generated marker
grep -rL "generated" skills/workos-sso/SKILL.md  # should find it

# Verify hand-crafted NOT marked
grep -L "generated" skills/workos-authkit-nextjs/SKILL.md  # should NOT find it
```

## Open Items

- [ ] Exact list of sections to `skip` may need tuning after seeing generated output
- [ ] AuthKit section: should any subsections become standalone skills beyond the 6 framework skills? (e.g., workos-authkit-sessions, workos-authkit-roles). Decide after seeing router coverage.
- [ ] Migration skills (per-subsection split): depends on how many migration targets exist in the docs. May produce 3-8 skills.

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
