# Implementation Spec: WorkOS Skills Generator - Phase 1

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

Phase 1 establishes the repo as a publishable npm package, copies the 6 AuthKit skills from the CLI, and builds the parser/fetcher foundation that Phase 2 depends on.

The repo uses Bun for TypeScript execution and testing. The parser extracts a structured section tree from `llms-full.txt` using the `## Section {#anchor}` pattern — this tree drives all downstream skill generation. A format validation guard ensures the parser fails loudly if WorkOS changes the document structure.

The package is set up to be publishable with `skills/` in the `files` array, compatible with both npm distribution and skills.sh (`npx skills add workos/skills`).

## File Changes

### New Files

| File Path                                       | Purpose                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `package.json`                                  | npm package config: name, version, files (includes `skills/`), scripts    |
| `tsconfig.json`                                 | TypeScript strict config for Bun                                          |
| `.gitignore`                                    | Node/Bun ignores + `.cache/` for local fetcher cache                      |
| `scripts/generate.ts`                           | Entry point: orchestrates fetch → parse → validate pipeline               |
| `scripts/lib/types.ts`                          | Shared interfaces: `Section`, `Subsection`, `SkillSpec`, `SplitStrategy`  |
| `scripts/lib/fetcher.ts`                        | Fetch `llms.txt` and `llms-full.txt` with retry + local `.cache/` for dev |
| `scripts/lib/parser.ts`                         | Parse markdown into section tree using `{#anchor}` boundaries             |
| `scripts/lib/validator.ts`                      | Validate parsed sections (expected count, non-empty, structure guards)    |
| `scripts/lib/config.ts`                         | Section config: split strategies, size thresholds, known anchors          |
| `scripts/tests/parser.test.ts`                  | Unit tests for parser                                                     |
| `scripts/tests/fetcher.test.ts`                 | Unit tests for fetcher (with mocked responses)                            |
| `scripts/tests/validator.test.ts`               | Unit tests for validator                                                  |
| `skills/workos-authkit-base/SKILL.md`           | Copied from CLI                                                           |
| `skills/workos-authkit-nextjs/SKILL.md`         | Copied from CLI                                                           |
| `skills/workos-authkit-react/SKILL.md`          | Copied from CLI                                                           |
| `skills/workos-authkit-react-router/SKILL.md`   | Copied from CLI                                                           |
| `skills/workos-authkit-tanstack-start/SKILL.md` | Copied from CLI                                                           |
| `skills/workos-authkit-vanilla-js/SKILL.md`     | Copied from CLI                                                           |

## Implementation Details

### Package Setup

**Overview**: Configure repo as a publishable npm package compatible with skills.sh.

```typescript
// package.json (key fields)
{
  "name": "@workos-inc/skills",
  "version": "0.1.0",
  "type": "module",
  "files": ["skills"],
  "scripts": {
    "generate": "bun run scripts/generate.ts",
    "test": "bun test"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/bun": "latest"
  }
}
```

**Key decisions**:

- `files: ["skills"]` — only the skills directory ships in the npm package, not scripts/
- No runtime dependencies — generator script uses Bun built-ins only
- `type: "module"` — ESM only

### Fetcher

**Overview**: Downloads `llms.txt` and `llms-full.txt` from WorkOS docs site. Caches locally in `.cache/` for fast dev iteration. Retry logic for network failures.

```typescript
interface FetchResult {
  content: string;
  source: "cache" | "network";
  fetchedAt: Date;
}

interface FetchOptions {
  cacheDir?: string; // default: .cache/
  maxAge?: number; // cache TTL in ms, default: 1 hour
  retries?: number; // default: 3
}

async function fetchDocs(
  url: string,
  opts?: FetchOptions,
): Promise<FetchResult>;
async function fetchLlmsTxt(opts?: FetchOptions): Promise<FetchResult>;
async function fetchLlmsFullTxt(opts?: FetchOptions): Promise<FetchResult>;
```

**Key decisions**:

- Local cache prevents hammering WorkOS on every dev run
- Cache TTL of 1 hour — fresh enough for dev, won't cause surprises
- Bun's native `fetch()` — no dependencies

**Implementation steps**:

1. Check `.cache/{filename}` exists and is within TTL
2. If cached, read and return with `source: 'cache'`
3. If not, `fetch()` from URL with retry loop (3 attempts, 1s backoff)
4. Write response to `.cache/{filename}` with timestamp metadata
5. Return with `source: 'network'`

### Parser

**Overview**: Parses `llms-full.txt` into a section tree. This is the core data structure all downstream generation depends on.

```typescript
interface Section {
  name: string; // "Single Sign-On"
  anchor: string; // "sso"
  content: string; // Full markdown content
  sizeBytes: number;
  lineCount: number;
  subsections: Subsection[];
}

interface Subsection {
  title: string; // "Test SSO"
  level: number; // 2 or 3 (heading level)
  content: string;
  sizeBytes: number;
}

function parseSections(markdown: string): Section[];
function parseSubsections(sectionContent: string): Subsection[];
```

**Key decisions**:

- Split on `## SectionName {#anchor}` regex — this is the authoritative boundary
- Subsections split on `### Heading` within each section
- Content includes everything between boundaries (code blocks, tables, lists)
- Regex must handle code blocks containing `##` (don't split inside fenced blocks)

**Implementation steps**:

1. Find all `## ... {#anchor}` matches with positions
2. Extract content between consecutive matches
3. For each section, find `### ...` boundaries for subsections
4. Calculate size/line counts
5. Return ordered array of `Section` objects

### Format Validator

**Overview**: Guards against llms-full.txt format changes. Fails loudly with actionable error messages.

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sectionCount: number;
  totalSize: number;
}

function validateSections(sections: Section[]): ValidationResult;
```

**Validation checks**:

- Expected section count (24 ± 3 — allow minor additions/removals)
- Known anchor names are present (sso, authkit, integrations, etc.)
- No section is empty (0 bytes)
- No section exceeds 600KB (current max is 474KB integrations)
- Total content size is within expected range (1MB ± 300KB)

**Implementation steps**:

1. Check section count bounds
2. Verify known anchors present
3. Check each section for empty content
4. Check size bounds
5. Aggregate warnings (unexpected anchors, size outliers)
6. Return result with actionable error messages

### Copy CLI Skills

**Overview**: Copy 6 AuthKit skills from CLI repo to `skills/` directory.

**Implementation steps**:

1. Read each `SKILL.md` from `/Users/nicknisi/Developer/cli/main/skills/workos-authkit-*/SKILL.md`
2. Create `skills/{name}/SKILL.md` in this repo
3. Copy byte-for-byte — no transformations

## Testing Requirements

### Unit Tests

| Test File                         | Coverage                                                          |
| --------------------------------- | ----------------------------------------------------------------- |
| `scripts/tests/parser.test.ts`    | Section extraction, subsection parsing, code-block-safe splitting |
| `scripts/tests/fetcher.test.ts`   | Cache hit/miss, retry logic, TTL expiry                           |
| `scripts/tests/validator.test.ts` | Expected sections, empty checks, size bounds                      |

**Key test cases**:

- Parser handles code blocks containing `##` without splitting
- Parser extracts all 24 known sections from real `llms-full.txt` fixture
- Fetcher returns cached result when within TTL
- Fetcher retries on network failure
- Validator rejects empty sections
- Validator warns on unexpected section count

### Integration Tests

**Key scenarios**:

- Full pipeline: fetch (from cache fixture) → parse → validate succeeds
- Validator fails with clear message when given malformed input

### Manual Testing

- [ ] `bun run scripts/generate.ts` completes without errors
- [ ] 6 AuthKit skills present in `skills/` and match CLI source
- [ ] Parser output matches expected section count and anchors

## Error Handling

| Error Scenario                    | Handling Strategy                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Network fetch fails after retries | Throw with "Failed to fetch {url} after {n} retries. Check network."                           |
| llms-full.txt format changed      | Validator throws with specific mismatches: "Expected 24 sections, got {n}. Missing: {anchors}" |
| Cache directory not writable      | Log warning, continue without caching                                                          |
| Empty section parsed              | Validator error: "Section '{anchor}' has 0 bytes of content"                                   |

## Validation Commands

```bash
# Type checking
bun run --bun tsc --noEmit

# Tests
bun test

# Run generator (Phase 1: parse + validate only)
bun run scripts/generate.ts

# Verify CLI skills copied
ls skills/workos-authkit-*/SKILL.md
```

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
