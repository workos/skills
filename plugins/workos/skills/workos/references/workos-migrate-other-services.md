# WorkOS Migration: Other Services

## Docs

- https://workos.com/docs/migrate/other-services
  If this file conflicts with fetched docs, follow the docs.

## Gotchas

- WorkOS only supports these hash algorithms for password import: bcrypt, scrypt, pbkdf2, argon2, ssha, ssha256, firebase-scrypt. The Node SDK `PasswordHashType` (v11) omits `pbkdf2` and `ssha256` even though the API accepts them; cast the value or call the API directly for those. If your source uses md5, sha1, or a custom algorithm, you cannot import passwords — use the password reset flow instead.
- OAuth tokens cannot be imported for security reasons. Social auth users must re-authenticate with their provider. WorkOS links accounts automatically by email match — if emails differ between WorkOS and the social profile, the user sees a "create new account" flow instead of linking.
- WorkOS user IDs (`user_01...`) are new. Persist the mapping from your old system's IDs or you break all foreign key references.
- Email matching for social account linking is case-sensitive. If the WorkOS user email doesn't exactly match the social profile email, auto-linking fails silently.
- Make migration scripts idempotent (track status per user) so re-runs don't create duplicates.
- Bulk password reset emails can be throttled or spam-filtered. Batch at 10 resets/sec max and verify your sending domain in WorkOS Dashboard.
