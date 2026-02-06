# @workos/skills

Claude Code plugin providing WorkOS integration skills (AuthKit, SSO, Directory Sync, RBAC, FGA, etc.).

## Commands

```bash
bun run generate              # fetch docs, parse, split, generate SKILL.md files
bun run generate -- --refine  # + AI refinement pass (requires ANTHROPIC_API_KEY)
bun run generate -- --refine-only=workos-sso  # refine single skill
bun test                      # run tests (bun test runner)
bun run format                # prettier --write
bun run format:check          # prettier --check
```

## Project Structure

- `skills/` — SKILL.md files consumed by Claude Code at runtime
  - **Hand-crafted** (never overwrite): `workos-authkit-base`, `workos-authkit-nextjs`, `workos-authkit-react`, `workos-authkit-react-router`, `workos-authkit-tanstack-start`, `workos-authkit-vanilla-js`
  - **Generated** — everything else; produced by `scripts/generate.ts`
- `scripts/` — generation pipeline
  - `generate.ts` — orchestrator: fetch → parse → split → generate → refine → validate → write
  - `lib/` — pipeline modules: `fetcher`, `parser`, `validator`, `splitter`, `api-ref-splitter`, `generator`, `skill-template`, `refiner`, `quality-gate`, `config`, `types`
  - `tests/` — `*.spec.ts` files using `bun:test`

## Key Conventions

- **Never overwrite hand-crafted skills.** They are listed in `scripts/lib/config.ts` (`HAND_CRAFTED_SKILLS`). The generator skips them and validates no conflicts.
- Generated skills follow the gold standard pattern in `skills/workos-authkit-nextjs/SKILL.md`.
- Skills have YAML frontmatter (`name`, `description`) followed by structured markdown.
- Section split strategies are configured in `scripts/lib/config.ts` (`SECTION_CONFIG`).
- Size constraints: skills must be 500B–50KB (`VALIDATION` in config).

## Runtime

- **Bun** — runtime and test runner (not Node)
- **TypeScript** — strict mode, ESNext target, bundler module resolution
- No build step; scripts run directly via `bun run`
