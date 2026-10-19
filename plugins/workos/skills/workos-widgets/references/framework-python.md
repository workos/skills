# Framework: Python

Use the official WorkOS Python SDK for Python apps (for example Django/Flask/FastAPI) that generate widget tokens and/or broker widget API requests. Place token generation in existing service/view/router boundaries.

## Token Pattern

```py
from workos import WorkOSClient

workos_client = WorkOSClient(
    api_key=os.environ["WORKOS_API_KEY"],
    client_id=os.environ["WORKOS_CLIENT_ID"],
)

token_response = workos_client.widgets.get_token(
    organization_id=organization_id,
    user_id=user_id,
    scopes=["widgets:users-table:manage"],
)
```
