# Skill Consolidation Contract

**Created**: 2026-02-10
**Confidence Score**: 97/100
**Status**: Draft

## Problem Statement

The @workos/skills plugin currently exposes 39 skills in the Claude Code system prompt. Every skill's name and description is injected into the prompt on every turn, consuming context window and making it harder for Claude to identify the right skill. Users see a wall of `workos-*` entries in the available skills listing — most of which they'll never invoke directly.

The router skill (`workos`) already exists and does a good job of mapping user intents to specific sub-skills. But it's listed alongside all 39 peers rather than serving as the primary entry point. The result: the router competes for attention with the very skills it's meant to route to.

This is a visibility/discovery problem, not a functionality problem. All 39 skills work correctly. The fix is controlling which skills appear in the system prompt and how the router loads hidden ones.

## Goals

1. **Reduce exposed skills from 39 to 7** — only the router + 6 AuthKit framework skills appear in the system prompt.
2. **Preserve full functionality** — all 32 hidden skills remain on disk and are loadable via the router.
3. **Zero pipeline impact** — no changes to the generator, refiner, quality gate, or rules system.
4. **Router reads hidden skills** — update the router to use Read tool (file paths) instead of Skill tool (name references) for loading hidden sub-skills.

## Success Criteria

- [ ] `marketplace.json` lists exactly 7 plugins (workos, workos-authkit-base, workos-authkit-nextjs, workos-authkit-react, workos-authkit-react-router, workos-authkit-tanstack-start, workos-authkit-vanilla-js)
- [ ] Per-skill `.claude-plugin/plugin.json` files are only generated for the 7 exposed skills
- [ ] All 32 hidden skill SKILL.md files remain on disk, unchanged
- [ ] Router skill (`workos/SKILL.md`) references hidden skills via file paths (e.g., `Read skills/workos-sso/SKILL.md`) instead of `Load skill workos-sso`
- [ ] Router's disambiguation rules and decision flow remain functionally identical
- [ ] `bun run generate` still works correctly (skips hand-crafted, respects hashes)
- [ ] `bun test` passes
- [ ] AuthKit framework-detection skills still trigger correctly from their system prompt descriptions

## Scope Boundaries

### In Scope

- Update `build-plugin-manifests.ts` to distinguish "exposed" vs "hidden" skills
- Remove per-skill `.claude-plugin/` directories for hidden skills
- Regenerate `marketplace.json` with only 7 entries
- Rewrite router skill (`workos/SKILL.md`) to use Read-based loading for hidden skills
- Update router to use relative file paths from the plugin root

### Out of Scope

- Restructuring skills on disk — skills stay as `skills/{name}/SKILL.md`
- Changes to the generator or refiner pipeline — `bun run generate` untouched
- Merging or consolidating SKILL.md content across skills
- Changing how AuthKit skills work — they stay independently exposed
- Auto-bundling feature + API ref skills together

### Future Considerations

- Consolidate migration skills into a single `workos-migrate` skill with provider-specific sections
- Consider inlining high-traffic sub-skills (SSO, RBAC) directly into the router for faster loading
- Explore Claude Code's native "hidden skill" support if/when the platform adds it
- Consider whether `workos-authkit-base` should be hidden (it's an architectural reference, not directly invoked by users)

---

_This contract was generated from brain dump input. Review and approve before proceeding to specification._
