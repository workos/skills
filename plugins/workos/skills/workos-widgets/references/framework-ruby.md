# Framework: Ruby

Use the official WorkOS Ruby SDK for Ruby apps (for example Rails/Sinatra) that generate widget tokens and/or proxy widget API calls. Place token generation in existing service/controller boundaries.

## Token Pattern

```rb
require "workos"

WorkOS.configure do |config|
  config.api_key = ENV.fetch("WORKOS_API_KEY")
end

token = WorkOS.client.widgets.create_token(
  organization_id: organization_id,
  user_id: user_id,
  scopes: ["widgets:users-table:manage"]
)
```
