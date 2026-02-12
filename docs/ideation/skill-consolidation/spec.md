# Implementation Spec: Skill Consolidation

**Contract**: ./contract.md
**Estimated Effort**: S (Small)

## Technical Approach

The change has two parts: (1) update the manifest builder to only expose 7 skills, and (2) rewrite the router to load hidden sub-skills via file reads instead of the Skill tool.

The manifest builder (`build-plugin-manifests.ts`) currently generates a `plugin.json` for every non-excluded skill and lists them all in `marketplace.json`. We'll add an `EXPOSED_SKILLS` set that controls which skills get manifest entries. Hidden skills stay on disk but don't ship manifests.

The router skill (`workos/SKILL.md`) currently says "Load skill X" which relies on the Skill tool finding a registered skill. After consolidation, hidden skills won't be registered. The router will instead instruct Claude to use Glob to find the sub-skill's `SKILL.md` file (pattern: `**/workos-{name}/SKILL.md`) and Read it. This works regardless of the plugin's install path.

## File Changes

### Modified Files

| File Path                           | Changes                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/build-plugin-manifests.ts` | Add `EXPOSED_SKILLS` set. Only generate per-skill `plugin.json` and marketplace entries for exposed skills. Clean up hidden skills' `.claude-plugin/` dirs. |
| `skills/workos/SKILL.md`            | Rewrite routing instructions: replace "Load skill X" with "Search for and Read the SKILL.md file" pattern. Add a loading protocol section.                  |

### Deleted Files

| File Path                                           | Reason                                                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skills/workos-{hidden}/.claude-plugin/plugin.json` | 32 per-skill plugin.json files for hidden skills. No longer needed since these skills aren't registered. Deleted by the manifest builder or a one-time cleanup. |

## Implementation Details

### 1. Update `build-plugin-manifests.ts`

**Pattern to follow**: existing `EXCLUDE_FROM_MANIFEST` set in the same file

**Overview**: Add a new `EXPOSED_SKILLS` set that defines which skills get manifest entries. Invert the current logic — instead of "exclude these few", it becomes "only include these few". Also remove `.claude-plugin/` directories from hidden skills.

```typescript
/** Skills exposed in manifests (visible in system prompt) */
const EXPOSED_SKILLS = new Set([
  "workos", // Router — entry point for all WorkOS queries
  "workos-authkit-base", // Architectural reference
  "workos-authkit-nextjs", // Framework: Next.js
  "workos-authkit-react", // Framework: React SPA
  "workos-authkit-react-router", // Framework: React Router
  "workos-authkit-tanstack-start", // Framework: TanStack Start
  "workos-authkit-vanilla-js", // Framework: Vanilla JS
]);
```

**Key decisions**:

- Keep `EXCLUDE_FROM_MANIFEST` — it handles skills that shouldn't exist at all (deprecated/thin). `EXPOSED_SKILLS` is for skills that exist but are routed through.
- The filter logic: `if (EXCLUDE_FROM_MANIFEST.has(dir)) continue;` stays. Add: `if (!EXPOSED_SKILLS.has(dir)) { /* skip manifest generation, optionally clean up .claude-plugin dir */ continue; }`
- Delete hidden skills' `.claude-plugin/` directories to keep the repo clean. Use `rmSync` with `{ recursive: true, force: true }`.

**Implementation steps**:

1. Add `EXPOSED_SKILLS` constant after `EXCLUDE_FROM_MANIFEST`
2. In the `for (const dir of dirs)` loop, after the exclude check, add: `const isExposed = EXPOSED_SKILLS.has(dir);`
3. If not exposed: skip plugin.json generation, skip adding to `plugins` array, and delete existing `.claude-plugin/` directory if present
4. If exposed: existing behavior (generate plugin.json, add to marketplace)
5. Update the `console.log` at the end to report hidden vs exposed counts

### 2. Rewrite Router Skill (`workos/SKILL.md`)

**Overview**: Replace all "Load skill X" instructions with a file-read protocol. The router table stays the same, but the loading mechanism changes.

**Key decisions**:

- Use Glob pattern `**/workos-{name}/SKILL.md` to find sub-skill files. This works regardless of absolute install path.
- Add a "Loading Protocol" section at the top that explains how to load hidden sub-skills.
- Keep the existing disambiguation rules, decision flow, and AuthKit detection logic intact.
- The topic→skill map table stays but the "Load skill" column changes to just the skill directory name (used in the Glob pattern).

**Loading Protocol to add**:

```markdown
## Loading Protocol

Most WorkOS skills are loaded through this router. To load a sub-skill:

1. Identify the skill directory name from the table below (e.g., `workos-sso`)
2. Use Glob to find: `**/workos-sso/SKILL.md`
3. Use Read to read the file
4. Follow the instructions in the loaded file

**Exception**: AuthKit framework skills (workos-authkit-nextjs, workos-authkit-react, etc.)
are directly available via the Skill tool — no need to search for them.
```

**Changes to the topic table**:

- Replace "Load skill" column header with "Skill directory"
- Remove any "Load skill" / "load" language from the disambiguation rules — replace with "route to" or "use"
- In the decision flow, replace "Load X" with the file-read protocol reference

**Implementation steps**:

1. Add "Loading Protocol" section after "How to Use"
2. Update disambiguation rules — replace "Load" language with "Route to"
3. Update topic→skill table — column header change, same content
4. Update decision flow diagram — replace "Load X" with "Route to X (see Loading Protocol)"
5. Update edge cases section similarly
6. Keep the AuthKit detection section unchanged (those skills are directly exposed)

## Testing Requirements

### Unit Tests

| Test File                                      | Coverage                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `scripts/tests/build-plugin-manifests.spec.ts` | (new) Verify exposed vs hidden skill counts, marketplace.json structure |

**Key test cases**:

- `marketplace.json` contains exactly 7 entries
- All 7 exposed skills have per-skill `plugin.json` files
- Hidden skills do NOT have `.claude-plugin/` directories
- `EXCLUDE_FROM_MANIFEST` skills are fully excluded (no manifest, no directory)
- Skill names in `EXPOSED_SKILLS` all correspond to real skill directories

### Manual Testing

- [ ] Run `bun run scripts/build-plugin-manifests.ts` — verify 7 entries generated
- [ ] Verify `marketplace.json` has exactly 7 plugin entries
- [ ] Verify no `.claude-plugin/` dirs exist for hidden skills (e.g., `ls skills/workos-sso/.claude-plugin` should fail)
- [ ] Verify `.claude-plugin/` dirs exist for exposed skills (e.g., `ls skills/workos-authkit-nextjs/.claude-plugin` should succeed)
- [ ] Install the plugin in Claude Code and verify only 7 skills appear in the system prompt
- [ ] Ask Claude "help me set up SSO" — verify the router loads `workos-sso/SKILL.md` via Glob+Read
- [ ] Ask Claude "help me with AuthKit in Next.js" — verify `workos-authkit-nextjs` loads directly via Skill tool
- [ ] Run `bun test` — all existing tests pass
- [ ] Run `bun run generate` — verify it still works correctly

## Error Handling

| Error Scenario                          | Handling Strategy                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| Glob finds no match for sub-skill       | Router's fallback: WebFetch `https://workos.com/docs/llms.txt` (existing behavior) |
| Glob finds multiple matches             | Use first result (shouldn't happen with specific directory names)                  |
| Hidden skill SKILL.md deleted from disk | Same as "no match" — falls through to WebFetch fallback                            |

## Validation Commands

```bash
# Run all tests
bun test

# Rebuild manifests
bun run scripts/build-plugin-manifests.ts

# Check manifest counts
cat .claude-plugin/marketplace.json | bun -e "const m = await Bun.file('.claude-plugin/marketplace.json').json(); console.log('Plugins:', m.plugins.length)"

# Verify no hidden skills have .claude-plugin dirs
ls -d skills/workos-sso/.claude-plugin 2>/dev/null && echo "FAIL: hidden skill has .claude-plugin" || echo "PASS"

# Format check
bun run format:check
```

## Open Items

- [ ] Verify that Glob pattern `**/workos-{name}/SKILL.md` reliably resolves from Claude Code's working directory when the plugin is installed (vs. when developing locally)
- [ ] Consider whether `workos-authkit-base` should be hidden (it's rarely invoked directly by users — the router or other AuthKit skills reference it)

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
