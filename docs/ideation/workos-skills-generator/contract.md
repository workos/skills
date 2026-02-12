# WorkOS Skills Generator Contract

**Created**: 2026-02-06
**Confidence Score**: 97/100
**Status**: Approved

## Problem Statement

WorkOS maintains comprehensive documentation (~1.2MB) covering 24 product areas. Naively chunking these docs into skill files produces documentation-shaped content that lacks the procedural knowledge agents actually need — decision trees, verification checklists, error recovery, and runtime doc references.

The 6 hand-crafted AuthKit framework skills in the CLI repo demonstrate the right pattern: they encode _how to think about the task_ (decision trees, blocking preflight checks, version-specific branching) and tell the agent _where to fetch implementation details_ at runtime (WebFetch README before proceeding). The docs are a runtime resource, not content to paste into skills.

This project needs to produce ~20-25 robust, AuthKit-quality skills plus a routing layer — all generated via a re-runnable Bun script, with AI drafting and quality review.

## Architecture

This repo (`workos/skills`) is the **single source of truth** for all WorkOS skills. It serves two distribution channels:

1. **skills.sh** — `npx skills add workos/skills` for Claude Code, Cursor, Codex, Goose, etc.
2. **WorkOS CLI** — consumes this repo as an npm dependency (`@workos-inc/skills`) so the AI installer agent can use the skills. _Wiring up the CLI dependency is a separate effort._

The 6 AuthKit installer skills are **copied from the CLI repo** into this repo as the starting canonical copies. They serve dual purpose: standalone developer skills AND execution logic for the CLI's AI installer.

## Goals

1. **Build a routing skill** that uses `llms.txt` as its topic index — when the agent determines a user needs SSO help, it loads the SSO skill
2. **Generate ~20-25 robust feature skills** with decision trees, verification checklists, error recovery, and doc URL references — matching the quality bar of the existing AuthKit skills
3. **Create a single integration router skill** with a provider lookup table pointing to the right doc URL per provider (not 60 individual files)
4. **AI-generate + review** — script generates skill scaffolds with content drafted by AI, then the skill-reviewer agent grades each before inclusion
5. **Distribute via skills.sh** — `npx skills add workos/skills` installs to 20+ agents
6. **Establish single source of truth** — copy the 6 CLI AuthKit skills here; this repo becomes the canonical home

## Success Criteria

- [ ] Router skill correctly maps all 24 doc sections to specific skills
- [ ] Each feature skill contains: decision trees, verification checklist, error recovery, doc URL references
- [ ] Feature skills reference specific doc URLs for runtime WebFetch (not baked-in doc content)
- [ ] Integration router skill has a lookup table covering all providers with correct doc URLs
- [ ] 6 AuthKit skills copied from CLI repo and present in `skills/`
- [ ] Script is re-runnable: `bun run scripts/generate.ts` produces consistent output
- [ ] Generated skills contain `<!-- generated -->` marker; hand-crafted do not
- [ ] Skill-reviewer agent grades each generated skill ≥ passing before inclusion
- [ ] `skills/` directory is compatible with skills.sh format (`{name}/SKILL.md`)
- [ ] All tests pass (`bun test`)
- [ ] No skill exceeds 50KB; no feature skill under 1KB

## Scope Boundaries

### In Scope

- Copy 6 AuthKit skills from CLI repo (`/Users/nicknisi/Developer/cli/main/skills/`) to this repo
- **npm package setup** — `package.json` with proper name, `files` field including `skills/`, publishable to npm registry. CLI integration is a separate effort but the package must be ready to consume.
- Bun + TypeScript generator script with lib/ structure
- Parsing `llms.txt` to build router skill topic index and extract section URLs
- Parsing `llms-full.txt` to extract section content as AI drafting context
- Router skill generation (topic → skill dispatch table)
- AI-drafted feature skill generation (~15-20 skills: SSO, Directory Sync, RBAC, FGA, Vault, Widgets, Events, Audit Logs, Admin Portal, MFA, Magic Link, Feature Flags, Domain Verification, Custom Domains, Email, Pipes, Migrations)
- Integration router skill with provider lookup table
- API reference skills split by domain (~8-10 skills)
- Format validation guards (fail loudly if llms.txt structure changes)
- Quality review pass via skill-reviewer agent
- Unit tests via `bun test`

### Out of Scope

- Updating CLI to consume this package as a dependency — separate effort
- Removing skills from CLI repo — separate effort
- SDK README fetching and enrichment — future enhancement
- Publishing to skills.sh registry (manual step after repo is on GitHub)
- CI/CD automation for scheduled regeneration

### Future Considerations

- Wire up CLI to consume `@workos-inc/skills` as dependency (eliminates duplication)
- GitHub Action to regenerate skills on schedule and auto-PR changes
- SDK README integration pass (enrich skills with code examples)
- Skill versioning aligned with docs changes
- Analytics on skill installations via skills.sh

---

_This contract was generated from brain dump input. Review and approve before proceeding to specification._
