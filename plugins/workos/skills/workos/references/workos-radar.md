# WorkOS Radar

## Docs

- https://workos.com/docs/radar
- https://workos.com/docs/radar/overview
- https://workos.com/docs/radar/standalone
- https://workos.com/docs/reference/radar
- https://workos.com/docs/reference/radar/attempts
- https://workos.com/docs/reference/radar/lists
  If this file conflicts with fetched docs, follow the docs.

## Gotchas

- Radar is built into AuthKit natively — if using AuthKit, fraud detection works automatically. The standalone API is only needed for custom auth flows.
- Node SDK (v11+) methods are exactly `workos.radar.createAttempt`, `updateAttempt`, `addListEntry`, and `removeListEntry`, with camelCase options (`ipAddress`, `userAgent`, `authMethod`, `attemptStatus`). Older SDKs have no `radar` namespace; there, call the HTTP endpoints. Methods such as `workos.radar.assessAttempt` or `workos.radar.blockIpAddress` do not exist in any version.
- The standalone API is in preview — access requires contacting WorkOS support.
- Creating an attempt returns a `verdict`: `"allow"`, `"block"`, or `"challenge"`. Your app must act on the verdict; Radar does not block requests itself.
- All attempt fields are required: `ip_address`, `user_agent`, `email`, `auth_method`, `action`. Missing fields cause a 422.
- `auth_method` must be one of: `Password`, `Passkey`, `Authenticator`, `SMS_OTP`, `Email_OTP`, `Social`, `SSO`, `Other`. Claude tends to use lowercase or invented values.
- `action` accepts: `login`, `signup` (and variants like `sign-in`, `sign_up`). Use the simplest form.
- After a successful authentication, update the attempt with `attempt_status: "success"` (`updateAttempt({ id, attemptStatus: 'success' })`) to improve Radar's model (enables impossible travel detection).
- Block/allow lists use path-based routing: `POST /radar/lists/{type}/{action}` where type is `ip_address`, `domain`, `email`, `device`, `user_agent`, `device_fingerprint`, or `country`, and action is `block` or `allow`.
- `device_fingerprint` and `bot_score` are optional enrichment fields — pass them if your client-side SDK collects them.

## Endpoints

| Endpoint                        | Description                        |
| ------------------------------- | ---------------------------------- |
| `/radar`                        | Radar overview                     |
| `/attempts`                     | Attempt management                 |
| `/attempts/create`              | Create an attempt (get verdict)    |
| `/attempts/update`              | Update attempt status              |
| `/lists`                        | List management                    |
| `/lists/{type}/{action}/add`    | Add entry to block/allow list      |
| `/lists/{type}/{action}/remove` | Remove entry from block/allow list |
