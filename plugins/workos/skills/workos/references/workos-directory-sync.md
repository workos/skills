# WorkOS Directory Sync

## Docs

- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/attributes
  If this file conflicts with fetched docs, follow the docs.

## Gotchas

- dsync.deleted sends ONE event for the whole directory — it does NOT send individual dsync.user.deleted or dsync.group.deleted events. You must cascade-delete all users and groups by directory_id yourself.
- Use email as stable user identity, NOT the WorkOS directory*user*\* ID — the ID changes if a user is recreated in the IdP. Upsert by email.
- Return 200 from webhook handler IMMEDIATELY (WorkOS times out at 10s) — process events asynchronously after acknowledging
- Webhooks are NOT mandatory — the Events API (workos.events.listEvents) is a fully supported pull-based alternative for batch processing
- Webhook signature verification must use the RAW request body, not parsed JSON — parsing first breaks the signature
- Use dsync.\* wildcard for Events API filter, not just "dsync" — bare string returns nothing
- Events API after param must be within 30-day retention window
- User state "inactive" is far more common than "deleted" — most IdPs deactivate users rather than deleting them. Handle dsync.user.updated with state=inactive as a deprovisioning event.
- Webhook handler pattern: call workos.webhooks.verifyEvent() with raw body + workos-signature header + secret, THEN return 200, THEN process event in async handler. Order matters.
- Ruby webhook trap: use request.raw_post for signature verification, NOT request.body — Rails parses body into params which breaks the signature. Disable JSON parsing for the webhook endpoint (use ActionController::API or skip_before_action).
- Use upsert pattern (ON CONFLICT / upsert) for all webhook handlers — events can be delivered more than once. dsync.user.created should upsert, not insert.

## Endpoints

| Endpoint                | Description                |
| ----------------------- | -------------------------- |
| `/directory-sync`       | Directory Sync overview    |
| `/directory`            | Directory management       |
| `/directory-group`      | Directory group operations |
| `/directory-group/get`  | Get a directory group      |
| `/directory-group/list` | List directory groups      |
| `/directory-user`       | Directory user operations  |
| `/directory-user/get`   | Get a directory user       |
| `/directory-user/list`  | List directory users       |
| `/directory/delete`     | Delete a directory         |
| `/directory/get`        | Get a directory            |
| `/directory/list`       | List directories           |
