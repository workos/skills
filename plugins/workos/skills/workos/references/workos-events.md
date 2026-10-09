# WorkOS Events

## Docs

- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api
- https://workos.com/docs/events/data-syncing/data-reconciliation
- https://workos.com/docs/reference/events
- https://workos.com/docs/reference/events/list
  If this file conflicts with fetched docs, follow the docs.

## Gotchas

- Do not implement both webhooks and Events API polling simultaneously — this causes duplicate event processing.
- Webhook endpoints must return 200 OK quickly or the request times out. Acknowledge immediately, process asynchronously.
- Verify the webhook signature before processing by calling `workos.webhooks.constructEvent({ payload, sigHeader, secret })` with the raw request body and the `workos-signature` header, then return 200, then process asynchronously. JSON-parsing the body before verification breaks the signature check. In Ruby use `request.raw_post` (not `request.body`, which Rails parses into params) and disable JSON parsing for the webhook endpoint (`ActionController::API` or `skip_before_action`).
- `WORKOS_WEBHOOK_SECRET` is shown only once when registering the endpoint. Save it immediately.
- WorkOS may retry webhook deliveries. All event processing must be idempotent — deduplicate using `event.id`, not webhook delivery ID.
- For Events API polling, `last_event_id` must be stored persistently. If lost, you must backfill via date-range queries.
- Do NOT backfill by replaying webhooks. Webhook signatures expire. Always use the Events API for historical data.

## Endpoints

| Endpoint  | Description   |
| --------- | ------------- |
| `/events` | events        |
| `/list`   | events - list |
