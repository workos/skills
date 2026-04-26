#!/usr/bin/env bash
# Pack the package, extract it, and assert the canary reference tree is present.
# Catches the failure mode where the published tarball ships an empty `references/`
# directory — which would silently break consumers (CLI auto-install, etc.) that
# Read these files at runtime.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

cd "$REPO_ROOT"
pnpm pack --pack-destination "$OUT" >/dev/null

cd "$OUT"
TARBALL="$(ls workos-skills-*.tgz 2>/dev/null | head -n1)"
if [ -z "$TARBALL" ]; then
  echo "ERROR: pnpm pack did not produce a workos-skills-*.tgz" >&2
  exit 1
fi

tar -xzf "$TARBALL"
cd package

REQUIRED=(
  "plugins/workos/skills/workos/SKILL.md"
  "plugins/workos/skills/workos/references/workos-management.md"
  "plugins/workos/skills/workos/references/workos-rbac.md"
  "plugins/workos/skills/workos/references/workos-cli-upgrade.md"
  "plugins/workos/skills/workos-widgets/SKILL.md"
  "plugins/workos/skills/workos-widgets/references/detection.md"
)

MISSING=()
for f in "${REQUIRED[@]}"; do
  if [ ! -f "$f" ]; then
    MISSING+=("$f")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: tarball is missing required files:" >&2
  for f in "${MISSING[@]}"; do
    echo "  - $f" >&2
  done
  exit 1
fi

echo "Tarball contents OK ($TARBALL, ${#REQUIRED[@]} canary files present)"
