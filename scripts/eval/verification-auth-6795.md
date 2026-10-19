# AUTH-6795 verification — 2026-09-28

## Formatting cleanup

- Original base: `e25141bae047a7c837d93817347f95977598720f`.
- Published Widgets guidance/regressions are `f4b9a81` and `e733603` (original local commits `e4ee907` and `d491c1f`), including PR42 attribution and [version evidence](../../plugins/workos/skills/workos-widgets/references/version-evidence.md).
- Published cleanup commit `e252df1` (original local commit `903ba98`) reuses only Nick Nisi's job12 formatting patch `200edd40713fc9572ffd8e597295d350e5beb9ca` for `mcp/LISTINGS.md`, `mcp/README.md`, and `plugins/workos/.codex-plugin/plugin.json`. No SPA implementation imported.
- Before applying, all three files' worktree, HEAD, and original-base Git blob hashes matched; the worktree was clean. After applying, bytes matched job12's formatted files. Parsed JSON was identical; Markdown table cells and non-table lines were unchanged (only padding/separator widths changed).

## Required CHECK: passed

Using pnpm **10.27.0**, the complete original command exited successfully:

```bash
pnpm test && pnpm lint && pnpm format:check && pnpm build
```

After the PR50 review fixes: **280 tests passed** across 12 files; lint had zero warnings/errors; repository-wide formatting passed; build passed. Both the focused two-case Widgets dry run and full **75-case** dry run passed with `ANTHROPIC_API_KEY` unset. Dry runs cover loading/hashing only, not model-quality evidence.

## PR50 review follow-up

Reviewed head: `f9b7ba92fa12eb99b9a1ce950075cd6581812cbb`. All three findings were reproduced with failing offline tests before fixes:

- [Contradictory recommendations](https://github.com/workos/skills/pull/50#discussion_r4127086047): `provides no` / `offers no` denials now trigger the existing mixed/denied caps and error categories. Fixtures cover quotations, local metalinguistic negation, double negation, multiple claims, and accurate no-parity caveats. This remains a fixture-bounded heuristic, not semantic completeness or proof that an arbitrary answer is correct.
- [Stale headings](https://github.com/workos/skills/pull/50#discussion_r4127086092): all six framework guides link to `token-strategies.md#server-issuance-node-10130`. Tests resolve each file, heading and anchor.
- [Missing actual skill coverage](https://github.com/workos/skills/pull/50#discussion_r4127086145): two new `workos-widgets` cases explicitly load a fixed bundle: `SKILL.md`, `component-setup.md`, `token-strategies.md`, and `fetching-apis.md`. Migration/terminology cases still load only their named reference. This is **not** agent routing, recursive reference loading, or live docs fetching.

The Widgets bundle accepts no YAML-selected source paths; skill names and canonical paths are checked, including rejection of symlink substitution. The runner snapshots source paths, exact text and SHA-256 once, using that snapshot for input hashing and prompts and retaining it in JSON reports/transcripts. Offline tests compare against the shipped files, verify the skill's links to the selected references, check identity changes/cache keys and unsafe/missing sources, and exercise both prompt arms with generation and cache writes mocked. No model/provider calls were made.

## Separate scripts typecheck: baseline failure, not fixed

`pnpm exec tsc --noEmit` was rerun after the review fixes and still exits 2 with only the same three diagnostics below. The original base was archived inside this worktree with `scripts`, `plugins`, and `tsconfig.json`, then checked using the same installed compiler/dependencies. After normalizing the temporary path prefix, its diagnostics matched the current branch exactly:

- `scripts/refine-batch.ts:3`: missing `./lib/refiner.ts` (TS2307).
- `scripts/refine-batch.ts:4`: missing `./lib/types.ts` (TS2307).
- `scripts/refine-batch.ts:157`: expected 2 arguments, received 4 (TS2554).

Temporary baseline files were removed. No unrelated script fixes were made. `pnpm build` checks `src/index.ts` via `tsconfig.build.json`; it does **not** establish that the full scripts typecheck passes.

## Remaining gates

Offline checks do not prove live token issuance, permission enforcement, component operation, refresh/session switching, or improved model recommendations. Those require separately authorized runtime/model evaluation. No paid models, live tokens/components, provisioning, publication, or shared-checkout changes were performed for this cleanup. Publication and review metadata remain with Riker.
