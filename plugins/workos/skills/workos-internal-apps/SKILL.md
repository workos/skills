---
name: workos-internal-apps
description: Use when a WorkOS teammate wants to build, plan, scaffold, review, or test an internal app with AI, especially for Claude Day, Cloudflare internal apps, Slack bots, Doppler-backed integrations, product discovery docs, prototypes, or agent-assisted app building. Start here before generating app code from scratch.
---

# Building WorkOS internal apps with AI

Canonical framework: https://www.notion.so/35ed458aea8b81c8b49ffb6aeb491e4a

## Workflow

1. Read the Notion framework and the app/repo README before changing code.
2. If the idea is fuzzy, run an interview loop first:
   - ask one question at a time;
   - include your recommended answer;
   - continue until the problem, users, data sources, MVP, risks, and success criteria are clear;
   - write a short product brief before implementation.
3. Prefer the paved road:
   - new app: `wow app create`;
   - existing template: `workos/internal-app-example`;
   - Slack surface: `wow app add slack` when available.
4. Ground UI work with the WorkOS design guidance:
   - look for `DESIGN.md` or app-specific design notes;
   - use screenshots/examples when available;
   - keep layouts simple, data-dense, and consistent with the existing app.
5. Plan integrations and secrets before wiring them:
   - use Doppler or approved MCP/platform auth;
   - never paste long-lived secrets into prompts, code, docs, or screenshots;
   - prefer least-privilege, per-app credentials;
   - document dry-run commands for auth checks.
6. Validate before handoff:
   - run the repo's lint/typecheck/build/test scripts;
   - manually exercise the golden path;
   - create a PR for code changes;
   - include preview URLs, screenshots, setup notes, and remaining blockers.

## Discovery brief template

```text
Problem:
User:
Current workaround:
Data sources:
Primary workflow:
App shape: internal app | Slack bot | data/reporting workflow | prototype | agent
MVP:
Success criteria:
Risks / safety constraints:
Open questions:
```

## Guardrails

- Do not replace the internal app template with a generic scaffold unless the user explicitly asks.
- Do not invent `wow`, Doppler, Cloudflare, GitHub, or package-manager commands; verify from the repo or CLI help.
- Do not ask a non-engineer to manually debug credentials without explaining the specific missing permission/scope and where it should live.
- Do not call a prototype done until a human can see the UI or output and the main flow has been exercised.
- If there are code changes, use a reviewable branch/PR instead of direct pushes to `main`.
