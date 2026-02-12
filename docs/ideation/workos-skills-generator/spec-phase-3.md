# Implementation Spec: WorkOS Skills Generator - Phase 3

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

Phase 3 splits the API reference section into domain-specific skills, runs the quality review pass via skill-reviewer agent, and adds the final validation layer to ensure all generated skills meet the quality bar.

The API reference (~91KB) is structured by API domain (SSO endpoints, User Management, Directory Sync, etc.) and split into ~8-10 focused reference skills. Unlike feature skills, these are endpoint-oriented — they help agents make correct API calls.

The quality review is the gating step: every generated skill from Phase 2 and Phase 3 is reviewed by the skill-reviewer agent. Skills that don't pass are flagged for manual revision or exclusion.

## File Changes

### New Files

| File Path                                    | Purpose                                                      |
| -------------------------------------------- | ------------------------------------------------------------ |
| `scripts/lib/api-ref-splitter.ts`            | Split API reference section by domain                        |
| `scripts/lib/quality-gate.ts`                | Run skill-reviewer agent on generated skills, report results |
| `scripts/tests/api-ref-splitter.test.ts`     | Unit tests for API reference splitting                       |
| `skills/workos-api-sso/SKILL.md`             | Generated: SSO API reference skill                           |
| `skills/workos-api-user-management/SKILL.md` | Generated: User Management API reference                     |
| `skills/workos-api-directory-sync/SKILL.md`  | Generated: Directory Sync API reference                      |
| `skills/workos-api-audit-logs/SKILL.md`      | Generated: Audit Logs API reference                          |
| `skills/workos-api-organizations/SKILL.md`   | Generated: Organizations API reference                       |
| `skills/workos-api-webhooks/SKILL.md`        | Generated: Webhooks/Events API reference                     |
| `skills/workos-api-vault/SKILL.md`           | Generated: Vault API reference                               |
| `skills/workos-api-fga/SKILL.md`             | Generated: FGA API reference                                 |

### Modified Files

| File Path                       | Changes                                                     |
| ------------------------------- | ----------------------------------------------------------- |
| `scripts/generate.ts`           | Add API ref splitting step + quality gate step              |
| `scripts/lib/config.ts`         | Change `reference` strategy from `skip` to `per-api-domain` |
| `skills/workos-router/SKILL.md` | Add API reference skills to topic map                       |

## Implementation Details

### API Reference Splitter

**Overview**: The API reference section uses `# Domain Name` H1 headers to separate API domains. Each domain becomes a focused API reference skill.

```typescript
interface ApiDomain {
  name: string; // "Single Sign-On"
  slug: string; // "sso"
  endpoints: ApiEndpoint[];
  content: string; // Raw markdown
}

interface ApiEndpoint {
  method: string; // "GET", "POST", etc.
  path: string; // "/sso/connections/{id}"
  description: string;
}

function splitApiReference(referenceSection: Section): SkillSpec[];
function parseApiDomains(content: string): ApiDomain[];
```

**Key decisions**:

- Split on `# DomainName` H1 headers within the reference section
- Each domain becomes `workos-api-{slug}` skill
- Group related endpoints (e.g., SSO Profile + SSO Connection + SSO Logout = workos-api-sso)
- API ref skills have a different template: endpoint table + request/response examples + doc URLs

**API reference skill template**:

```markdown
---
name: workos-api-{domain}
description: WorkOS {Domain} API endpoints and usage patterns
---

<!-- generated -->

# WorkOS {Domain} API Reference

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET    | /... | ...         |
| POST   | /... | ...         |

## Documentation

For full request/response schemas and examples:
WebFetch: {doc URL from llms.txt}

## Common Patterns

{Typical usage flows for this API domain}

## Error Codes

{Domain-specific error codes and handling}
```

**Implementation steps**:

1. Extract API reference section from parsed sections
2. Split by `# DomainName` H1 headers
3. For each domain, extract endpoint method/path/description
4. Group related domains (e.g., Connection + Profile under SSO)
5. Generate skill from template with endpoint table + doc URLs
6. Add to router skill's topic map

### Quality Gate

**Overview**: Reviews all generated skills for quality before final inclusion. Uses a scoring rubric to flag skills that need revision.

```typescript
interface QualityResult {
  skillName: string;
  pass: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

interface QualityReport {
  total: number;
  passed: number;
  failed: number;
  results: QualityResult[];
}

function runQualityGate(skills: GeneratedSkill[]): QualityReport;
```

**Scoring rubric** (automated checks, not AI):

- Has valid frontmatter with name + description (20 pts)
- Has `<!-- generated -->` marker (5 pts)
- Has WebFetch doc references (20 pts)
- Has at least 2 structural sections (## headings) (15 pts)
- Content length > 1KB (10 pts)
- Has verification checklist OR error recovery section (15 pts)
- No raw doc content > 2KB without structural formatting (15 pts — penalizes chunked docs)

**Pass threshold**: 70/100

**Key decisions**:

- Automated rubric first — catches obvious issues without AI cost
- Skills below 70 are flagged, not auto-deleted — human decides
- Quality report written to `scripts/output/quality-report.json`
- The skill-reviewer agent can be run separately as a manual step on flagged skills

**Implementation steps**:

1. Load all generated skills from `skills/`
2. Run rubric scoring on each
3. Generate quality report with pass/fail + per-skill details
4. Write report to `scripts/output/quality-report.json`
5. Log summary to console
6. Exit with non-zero if any skills fail (CI-friendly)

### Router Update

**Implementation steps**:

1. After API ref skills are generated, regenerate router skill
2. Add API reference skills to topic map: "API endpoints for {domain}" → `workos-api-{slug}`
3. Ensure router covers all skills (feature + API ref + AuthKit + integrations)

## Testing Requirements

### Unit Tests

| Test File                                | Coverage                                      |
| ---------------------------------------- | --------------------------------------------- |
| `scripts/tests/api-ref-splitter.test.ts` | Domain extraction, endpoint parsing, grouping |

**Key test cases**:

- Splits reference section into expected domain count (~8-10)
- Each domain has at least one endpoint
- Grouping works (SSO Profile + Connection = single SSO domain)
- Generated skill has endpoint table
- Quality gate passes well-formed skills
- Quality gate fails skills with no doc references
- Quality gate fails skills that are just raw chunked docs

### Manual Testing

- [ ] API reference skills cover all major API domains
- [ ] Each API ref skill has endpoint table and doc URLs
- [ ] Quality report generates with all skills scored
- [ ] Router skill updated with API reference entries
- [ ] `bun run scripts/generate.ts` runs full pipeline including quality gate

## Error Handling

| Error Scenario                          | Handling Strategy                                                    |
| --------------------------------------- | -------------------------------------------------------------------- |
| API reference section format unexpected | Log warning, skip API ref generation, don't fail entire pipeline     |
| Domain has no parseable endpoints       | Generate minimal skill with just doc URL reference                   |
| Quality gate fails >50% of skills       | Log error with summary, suggest running with `--verbose` for details |

## Validation Commands

```bash
# Tests
bun test

# Full generation pipeline
bun run scripts/generate.ts

# Check quality report
cat scripts/output/quality-report.json | jq '.passed, .failed'

# Verify total skill count (expect 30-40)
ls skills/*/SKILL.md | wc -l

# Verify no skill exceeds 50KB
find skills -name "SKILL.md" -size +50k

# Verify all generated skills have marker
grep -rL "generated" skills/workos-!(authkit)*/SKILL.md
```

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
