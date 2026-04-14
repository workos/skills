# WorkOS Feature Flags

## Docs

- https://workos.com/docs/feature-flags
- https://workos.com/docs/feature-flags/sdk-integration
- https://workos.com/docs/feature-flags/slack-notifications
- https://workos.com/docs/reference/feature-flags
- https://workos.com/docs/reference/feature-flags/flag
- https://workos.com/docs/reference/feature-flags/targeting
  If this file conflicts with fetched docs, follow the docs.

## Gotchas

- Feature flags are delivered via the `feature_flags` claim in the access token — NOT via a separate API call. You must read them from the session.
- Read the `feature_flags` claim from the session/access token. Some frameworks expose convenience helpers like `session.getFeatureFlag()`, but there is no standalone `workos.featureFlags.get()` API method. Claude tends to invent one.
- Flags have three targeting states: None (off for all), Some (targeted orgs/users), All (on for everyone). There is no percentage rollout — it's discrete targeting.
- Flag evaluation requires a valid session with `feature_flags` claim. If using `loadSealedSession()`, the claim is included automatically.
- To refresh flag values mid-session, call `session.refresh()` — stale tokens carry stale flag state.
- Flags are scoped per environment (sandbox vs production). A flag enabled in sandbox is NOT automatically enabled in production.
- Organization-level and user-level targeting are configured in the Dashboard, not via API. The API is read-only for flag definitions.
- Slack notifications for flag changes are opt-in and configured per flag in the Dashboard.
- In Next.js with `@workos-inc/authkit-nextjs`, use `getUser()` to access the session — feature flags are on the user/session object. Do NOT import `@workos-inc/node` and call `loadSealedSession()` directly in Next.js.

## Endpoints

| Endpoint     | Description                  |
| ------------ | ---------------------------- |
| `/flag`      | Feature flag management      |
| `/targeting` | Flag targeting configuration |
