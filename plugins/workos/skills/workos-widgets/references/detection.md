# Detection

Identify the active stack from dependency manifests and entrypoints, then fit the integration to the existing architecture. In mixed repositories, identify which app owns UI rendering and which service owns token generation.

## AuthKit/WorkOS Presence Signals

Check for existing AuthKit/WorkOS usage before implementing widgets:

- JavaScript/TypeScript: `@workos-inc/*`, `@workos/*`, or WorkOS/AuthKit imports
- Ruby/PHP/Python: WorkOS/AuthKit gems, composer packages, or packages/imports
- Go: `github.com/workos/workos-go` module import
- Java: WorkOS dependency/imports

If no AuthKit/WorkOS signal is found, see SKILL.md step 3.

When React Query (`@tanstack/react-query`) or SWR (`swr`) is already established, use it for caching/invalidation around direct endpoint calls.
