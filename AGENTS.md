# @workos/skills

Codex plugin providing WorkOS integration skills (AuthKit, SSO, Directory Sync, RBAC, FGA, etc.).

## Commands

```bash
# Testing & formatting
pnpm test                     # run tests (vitest)
pnpm format                   # oxfmt
pnpm lint                     # oxlint

# Evals
pnpm eval -- --dry-run                        # verify cases load (no API key needed)
pnpm eval -- --no-cache                       # full run, skip cache
pnpm eval -- --no-cache --product=sso         # run specific product
pnpm eval -- --no-cache --case=sso-node-basic # run single case
pnpm eval -- --no-cache --fail-on-regression  # full run with gates
pnpm eval -- --no-cache --samples=2           # multi-sample for variance measurement
pnpm eval -- --no-cache --samples=2 --save-all-samples  # + persist all sample outputs

# Eval tooling
pnpm eval:diff -- --case=sso-node-basic       # side-by-side transcript diff with signal highlighting
pnpm eval:label -- --case=X --ship=yes --who=nick --reason="..."  # add human judgment
pnpm eval:calibrate                            # compare scorer vs human labels
```

## Project Structure

- `.agents/plugins/marketplace.json` — Codex marketplace catalog (source: `./plugins/workos`)
- `.cursor-plugin/marketplace.json` — Cursor marketplace catalog (mirrors Claude catalog)
- `plugins/workos/` — installable plugin (only this gets cached)
  - `.codex-plugin/plugin.json` — Codex plugin manifest
  - `.cursor-plugin/plugin.json` — Cursor plugin manifest (mirrors Claude manifest; versions synced by release-please)
  - `skills/` — skill directories, each with `SKILL.md`
    - **Hand-crafted AuthKit skills**: `workos-authkit-base`, `workos-authkit-nextjs`, `workos-authkit-react`, `workos-authkit-react-router`, `workos-authkit-tanstack-start`, `workos-authkit-vanilla-js`, `workos-widgets`
    - **Router**: `workos/SKILL.md` — routes user requests to the right topic file or AuthKit skill
    - **Topic files**: `workos/references/*.md` — lean files with doc URLs + gotchas + optional endpoint tables
- `scripts/` — eval framework (not cached with plugin)
  - `tests/` — `*.spec.ts` files using vitest

## Key Conventions

- **Hand-crafted AuthKit skills are separate plugins** with their own `SKILL.md`. Do not modify them when working on topic files.
- **Topic files are human-maintained.** Each contains doc URLs (source of truth), gotchas (non-obvious traps), and optional endpoint tables. No generation pipeline — edit directly.
- **"Fetch docs first" is the core pattern.** Every topic file starts with doc URLs and the line "If this file conflicts with fetched docs, follow the docs."
- **Gotchas encode what Codex gets wrong.** Add a bullet when you discover the LLM produces incorrect output for a topic. Sources: eval failures, support patterns, breaking changes.
- **The router (`workos/SKILL.md`) handles discovery.** Topic files have no frontmatter — the router table maps user intent to file paths.

## Runtime

- **Node** (>=18) via **tsx** — TypeScript execution without build step
- **vitest** — test runner
- **TypeScript** — strict mode, ESNext target, bundler module resolution
- No build step; scripts run directly via `npx tsx`

## Eval Framework

Measures whether skills improve agent-generated WorkOS implementations. Runs each case with and without the skill, scores both outputs, and reports the delta.

### Eval Commands

```bash
pnpm eval -- --dry-run                        # verify cases load
pnpm eval -- --no-cache --product=sso         # run specific product
pnpm eval -- --no-cache --lang=python         # run specific language
pnpm eval -- --no-cache --case=sso-node-basic # run single case
pnpm eval -- --no-cache --fail-on-regression  # full run with gates
pnpm eval -- --no-cache --samples=2           # run each case 2x, report mean ± stddev
pnpm eval -- --no-cache --samples=2 --save-all-samples  # + persist all sample outputs
bash scripts/eval-ci.sh                       # CI wrapper
bash scripts/eval-ci.sh --dry-run             # CI dry run (no API key needed)
```

### Eval Tooling

```bash
pnpm eval:diff -- --case=sso-node-basic       # side-by-side with/without transcript diff
pnpm eval:diff -- --case=X --run=2026-02-26   # diff a specific run
pnpm eval:label -- --case=X --ship=yes --who=nick --reason="correct flow"  # add human label
pnpm eval:calibrate                            # scorer vs human agreement report
```

### Interpreting Results

- **Delta** = with-skill composite minus without-skill composite
- **Positive delta** = skill helps. Target: ≥ +8
- **Zero delta** = skill adds no value for this scenario (LLM already knows)
- **Negative delta** = skill hurts — investigate for wrong information in skill
- GREEN (≥ +20%): strong skill value
- YELLOW (≥ +10%): moderate skill value
- RED (< +10%): low skill value

**Hard gates** (`--fail-on-regression`): no product with negative avg delta, hallucination reduction ≥ 50%, calibration agreement ≥ 80% (when 10+ labels exist).

**Triage report**: auto-prints top 10 risky cases (negative delta, high σ, hallucination regression) after each run.

### Troubleshooting

- **Rate limits**: `--concurrency=1`
- **Stale cache**: `--no-cache`
- **Single case debugging**: `--case=<id>`
- **Variance analysis**: `--samples=2` (or 3) — costs ~Nx, auto-disables cache
- **Token costs**: ~$1.70 per full 42-case run, ~$3.40 with `--samples=2`

## Do / Don't

**Do:**

- Edit topic files (`plugins/workos/skills/workos/references/*.md`) directly -- they are human-maintained
- Start every topic file with doc URLs and "If this file conflicts with fetched docs, follow the docs."
- Add gotcha bullets when you discover the LLM produces incorrect output for a topic
- Update the router table in `plugins/workos/skills/workos/SKILL.md` when adding new topic files
- Write `.spec.ts` tests in `scripts/tests/` for eval framework changes

**Don't:**

- Modify the `workos-widgets` skill when working on reference files
- Add frontmatter to topic files -- the router handles discovery
- Change the plugin directory structure under `plugins/workos/` without considering caching boundaries
- Skip `--dry-run` before running full evals

## PR Checklist

- [ ] `pnpm test` passes (vitest)
- [ ] `pnpm lint` passes (oxlint)
- [ ] `pnpm format` passes (oxfmt)
- [ ] `pnpm eval -- --dry-run` loads all cases without error
- [ ] Topic file changes include doc URLs as source of truth
