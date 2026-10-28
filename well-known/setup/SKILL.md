---
name: workos-setup
description: Set up WorkOS AuthKit sign-in in a project with `npx workos@latest install`, which needs no WorkOS account. Use when the user asks to add WorkOS or AuthKit authentication to an app, to scaffold a new app with WorkOS, or to claim the temporary WorkOS environment the installer created.
---

# Set up WorkOS

The WorkOS CLI adds AuthKit sign-in to a project. When it finds no WorkOS
credentials, it provisions a temporary WorkOS environment, so the user doesn't
need a WorkOS account to start. They can claim the environment into their
account later.

## Before you start

Tell the user what you will do and wait for a yes:

1. Add WorkOS AuthKit sign-in to this project, or scaffold a new Next.js app if
   the directory is empty.
2. Use the project's existing WorkOS credentials if it has them. Otherwise,
   create a temporary WorkOS environment they can claim later.

If the project already uses a different auth provider, stop and agree on a
migration plan before changing anything. Don't remove existing auth without
approval.

## Run the installer

From the project root:

```bash
WORKOS_MODE=agent npx workos@latest install
```

- It writes `WORKOS_API_KEY`, `WORKOS_CLIENT_ID` and, for a new environment,
  `WORKOS_CLAIM_TOKEN` to `.env.local` (or `.env` when there is no
  `package.json`), and adds that file to `.gitignore`. Don't delete the claim
  token or the CLI profile before the environment is claimed.
- It puts its changes on a new git branch. Pass `--no-branch` to stay on the
  current one. If it stops with `git_dirty`, ask the user to commit or stash
  first.
- In agent mode it prints JSON. On failure, follow `error.recovery.hints`. Exit
  code `4` means it could not provision an environment: ask the user to run
  `npx workos@latest install` in their own terminal, and don't write keys
  yourself.
- If the user already has a WorkOS account, have them run
  `npx workos@latest auth login` in their own terminal first, since it opens a
  browser. The installer then uses their Staging environment instead of
  creating a temporary one.

## Verify

The installer's success report is not proof that sign-in works. It also
reports which application URLs (Sign-out URI, Initiate login URI, CORS origin)
it saved and which it left for you. Start the app and check that:

- Sign-in completes and creates an app session.
- Sign-out ends the session and lands on the configured Sign-out URI.
- A sign-in started outside the app, such as an invitation or password-reset
  email, reaches the Initiate login URI and continues without a loop or
  callback error.

The Initiate login URI must be an app route that starts AuthKit sign-in, not
the callback. Configure any URL the installer left by following the
framework's AuthKit guide at https://workos.com/docs/authkit, or
`references/workos-authkit-setup.md` if the `workos` skill is installed. If you
can't save a setting or test a flow, tell the user exactly which ones remain.
Never call setup complete from the installer's report, a build, or `doctor`
output alone. To diagnose a broken integration, run
`WORKOS_MODE=agent npx workos@latest doctor --json --skip-ai`.

## Claim the environment

Only if the installer created a new environment (the env file gained
`WORKOS_CLAIM_TOKEN`), tell the user it is temporary and how to claim it. On
the same machine:

```bash
WORKOS_MODE=agent npx workos@latest profile claim
```

In agent mode it returns a claim URL as JSON. Give that URL to the user, who
signs in or creates a free account and confirms. Claiming is permanent. Never
ship a temporary environment's keys to production.

## Go further

- WorkOS skills for coding agents: `npx skills add https://workos.com`. Ask
  first, since it writes into the agent's skills folder. The `workos` skill
  covers SSO, Directory Sync, RBAC, migrations, and the rest of WorkOS.
- Documentation index: https://workos.com/docs/llms.txt. Add `.md` to any
  documentation URL to get Markdown.
- Raw HTTP steps for provisioning and claiming an environment without Node.js:
  https://workos.com/auth.md
