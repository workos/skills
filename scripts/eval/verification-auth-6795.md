# AUTH-6795 verification — 2026-09-29

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

After the latest PR50 review fixes: **372 tests passed** across 14 files; lint had zero warnings/errors; repository-wide formatting passed; build passed. Both the focused three-case Widgets dry run and full **76-case** dry run passed with `ANTHROPIC_API_KEY` unset. Dry runs cover loading/hashing only, not model-quality evidence.

## PR50 review follow-up

Reviewed head: `f9b7ba92fa12eb99b9a1ce950075cd6581812cbb`. All three findings were reproduced with failing offline tests before fixes:

- [Contradictory recommendations](https://github.com/workos/skills/pull/50#discussion_r4127086047): `provides no` / `offers no` denials now trigger the existing mixed/denied caps and error categories. Fixtures cover quotations, local metalinguistic negation, double negation, multiple claims, and accurate no-parity caveats. This remains a fixture-bounded heuristic, not semantic completeness or proof that an arbitrary answer is correct.
- [Stale headings](https://github.com/workos/skills/pull/50#discussion_r4127086092): all six framework guides link to `token-strategies.md#server-issuance-node-10130`. Tests resolve each file, heading and anchor.
- [Missing actual skill coverage](https://github.com/workos/skills/pull/50#discussion_r4127086145): two new `workos-widgets` cases explicitly load a fixed bundle: `SKILL.md`, `component-setup.md`, `token-strategies.md`, and `fetching-apis.md`. Migration/terminology cases still load only their named reference. This is **not** agent routing, recursive reference loading, or live docs fetching.

The Widgets bundle accepts no YAML-selected source paths; skill names and canonical paths are checked, including rejection of symlink substitution. The runner snapshots source paths, exact text and SHA-256 once, using that snapshot for input hashing and prompts and retaining it in JSON reports/transcripts. Offline tests compare against the shipped files, verify the skill's links to the selected references, check identity changes/cache keys and unsafe/missing sources, and exercise both prompt arms with generation and cache writes mocked. No model/provider calls were made.

## Second PR50 review follow-up

Reviewed head: `6041ec6aec51878d095b33f8b1c4ab01e3cf861f`. Both evaluation-accuracy findings were reproduced before fixes, independently of the 5/5 review score:

- [Adjacent evidence](https://github.com/workos/skills/pull/50#discussion_r4127306043): the assessor now recognizes an explicit package/vendor recommendation immediately followed by “its UserProfile provides/offers … UI” across a semicolon or sentence boundary. It does not combine arbitrary nearby mentions. Excluded quotations/code preserve boundaries; negated or retracted recommendations, unrelated intervening text, quoted bad examples, denials and parity overclaims remain covered by capped fixtures. Previous denial tests still pass. This adds a bounded pattern, not semantic completeness.
- [AuthKit token strategy](https://github.com/workos/skills/pull/50#discussion_r4127306054): `widgets-organization-versioned-setup` now explicitly reuses the existing AuthKit React getter/switch helper and expects `getAccessToken`, `switchToOrganization`, and AuthKit React imports—not backend issuance. A separate `widgets-organization-server-token-setup` case explicitly requests Node 10.13.0 server issuance and retains the backend signals. The profile case still requires server issuance.

Representative AuthKit and server-token answers both receive full deterministic credit under their respective loaded cases; cross-strategy tests still detect missing required methods/imports/parameters. The representative snippets were not executed, and these scores do not establish runtime correctness or improved model recommendations. The fixed source bundle and migration/terminology case boundaries are unchanged.

## Third PR50 review follow-up

Reviewed head: `be49d0612d2af9f2e1fdbc9bc4009b75a283e932`. The [explicit retraction finding](https://github.com/workos/skills/pull/50#discussion_r4127519017) was reproduced through `scoreOutput` before the fix. The exact “Recommend WorkOS Widgets … Avoid WorkOS Widgets” input now returns `unknown` with composite **60**, preserving the existing retraction/unknown cap rather than allowing an uncapped recommendation.

Recommendation and rejection paths now share target, action and negation vocabulary. Direct avoidance, negated use/recommendation, and target-first passive rejections recognize package/Widgets/UserProfile targets without requiring them to end the clause. Earlier or later retractions veto both same-clause and adjacent-clause positive evidence. Both positive paths and retractions use the same quotation/code/labeled-example exclusions; explicit no-drop-in qualifications and negated avoidance are not treated as withdrawals.

The 48 new table-driven tests cover the exact score cap, trailing explanations, target boundaries/aliases, punctuation/case, both orderings, both positive paths, and quoted or labeled examples versus actual retractions. Previous semicolon-linkage, denial/parity, source-loading, and AuthKit/server-token strategy tests still pass. This is a bounded grammar, not a claim to understand every paraphrase. No model or runtime calls were made; the three baseline scripts typecheck errors were rechecked and remain unchanged.

## Fourth PR50 review follow-up

Reviewed head: `326c047a52d9b7eb0682d1b1891bfe2b247f66fb`. The [authentication-purpose false positive](https://github.com/workos/skills/pull/50#discussion_r4137798393) was reproduced through `scoreOutput` before the fix. “WorkOS Widgets is not used for authentication” now preserves a valid UserProfile recommendation and receives the same composite as scoring without the recommendation cap.

A closed set of authentication/sign-in/login purpose qualifiers is distinguished from withdrawing the profile UI recommendation, for both active and passive wording. This is not a blanket exemption for “for …”: profile/account-UI rejections, mixed authentication-and-profile purposes, and general avoidance justified by authentication still count. Qualifiers must consume the remainder of their clause, and separate actual retractions still veto the recommendation.

The 17 added regressions cover valid boundaries before/after both positive forms, real withdrawals, and limitations combined with actual retractions. All earlier denial/parity, quotation, semicolon linkage, and AuthKit/server-token tests pass. Grammar coverage remains deliberately bounded; no runtime or model-quality proof is claimed.

## Accepted limit: whole-clause negation

Any negation in the same clause withholds recommendation credit, including an unrelated instruction such as “…, and do not change the existing AuthKit authentication flow”. That valid answer scores `unknown`, capped at 60. This is a known, accepted false negative, covered by a labeled regression. Keyword exemptions for “unrelated” negation were tried and reverted, because each one let a contradiction get full credit, for example “…, and no prebuilt screen exists” (also a regression). An honest `unknown` is preferred over false full credit. Do not add vocabulary exemptions.

## Separate scripts typecheck: baseline failure, not fixed

`pnpm exec tsc --noEmit` was rerun after the review fixes and still exits 2 with only the same three diagnostics below. The original base was archived inside this worktree with `scripts`, `plugins`, and `tsconfig.json`, then checked using the same installed compiler/dependencies. After normalizing the temporary path prefix, its diagnostics matched the current branch exactly:

- `scripts/refine-batch.ts:3`: missing `./lib/refiner.ts` (TS2307).
- `scripts/refine-batch.ts:4`: missing `./lib/types.ts` (TS2307).
- `scripts/refine-batch.ts:157`: expected 2 arguments, received 4 (TS2554).

Temporary baseline files were removed. No unrelated script fixes were made. `pnpm build` checks `src/index.ts` via `tsconfig.build.json`; it does **not** establish that the full scripts typecheck passes.

## Remaining gates

Offline checks do not prove live token issuance, permission enforcement, component operation, refresh/session switching, or improved model recommendations. Those require separately authorized runtime/model evaluation. No paid models, live tokens/components, provisioning, publication, or shared-checkout changes were performed for this cleanup. Publication and review metadata remain with Riker.
