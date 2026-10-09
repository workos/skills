# WorkOS CLI Upgrades

## Docs

- npm package: https://www.npmjs.com/package/workos
- Releases / changelog: https://github.com/workos/cli/releases

If this file conflicts with fetched docs, follow the docs.

Use this when the user is running an outdated `workos` CLI. Symptoms: `unknown command`, missing flags shown in newer docs, or the user explicitly asking how to update.

## Detecting an outdated CLI

- Confirm the running version with `workos --version`.
- Confirm the latest published version with `npm view workos version` (or `npm view workos dist-tags`). Do not guess: the latest moves frequently, so any version recalled from memory is almost certainly stale. A fabricated pin (`workos@0.13.0` when the real latest is `0.14.2`) leaves the user on a stale install with no obvious symptom.
- If running version < latest, recommend the upgrade command for the user's package manager (table below).
- If you cannot determine how they installed the CLI, recommend `npx workos@latest <command>` as a no-install fallback so they can unblock immediately.

## Upgrade commands by package manager

| Package manager | One-shot upgrade               | No-install alternative |
| --------------- | ------------------------------ | ---------------------- |
| npm             | `npm install -g workos@latest` | `npx workos@latest`    |
| pnpm            | `pnpm add -g workos@latest`    | `pnpm dlx workos`      |

The CLI is published to npm only. Default to `@latest` (it reinstalls in place) — pin a specific version only when the user explicitly asks (e.g. "stay on 0.12.x for CI"). Match the user's package manager: a `pnpm add -g` on top of a global npm install can leave two `workos` binaries on PATH; when unsure which they used, prefer the `npx workos@latest` form. Do not recommend Homebrew, asdf, or other version managers, and reach for uninstall-then-reinstall only if the user reports a corrupted install or a binary-shadow warning from `workos doctor`.

After upgrading, have the user re-run `workos --version` to confirm the new version is on PATH (a stale shim from a different package manager can shadow the upgrade — `workos doctor` flags this in newer versions).

## Gotchas

- **Global install on Node managed by `nvm` / `fnm` / `volta`**: each Node version has its own global prefix. Switching Node versions can make `workos` "disappear" until reinstalled under the new Node. The fix is to reinstall, not to chase the missing binary.
- **`npx` cache**: `npx workos@latest` may serve a cached older version on the first invocation after a release. Re-running once usually picks up the new tarball.
- **Corporate proxies / private registries**: if `npm view workos version` errors, the user may be on a private registry that mirrors npm. Have them check `npm config get registry`; the recommendations above assume the public npm registry.
