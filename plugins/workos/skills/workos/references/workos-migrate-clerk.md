# WorkOS Migration: Clerk

## Docs

- https://workos.com/docs/migrate/clerk
  If this file conflicts with fetched docs, follow the docs.

## Gotchas

- Clerk exports multiple emails pipe-separated (e.g., `john@example.com|john.doe@example.com`) and does not indicate which is primary, but WorkOS users have a single primary email. Resolve `primary_email_address_id` via the Clerk API per user, or pick the first email and document the choice.
- Clerk does not provide plaintext passwords. Password hashes are only available via the Clerk Backend API export, not the standard dashboard export.
- Clerk exports may include deleted/suspended users and duplicate emails, both of which cause WorkOS count mismatches or rejections.
- WorkOS has an official migration tool at https://github.com/workos/migrate-clerk-users that handles rate limits and retries.
