# Framework: Go

Use the official WorkOS Go SDK for Go services that issue widget tokens and support widget API integration. Place token generation in existing handler/service layers.

## Token Pattern

```go
import (
  "context"
  "os"

  "github.com/workos/workos-go/v6/pkg/widgets"
)

widgets.SetAPIKey(os.Getenv("WORKOS_API_KEY"))

token, err := widgets.GetToken(
  context.Background(),
  widgets.GetTokenOpts{
    OrganizationID: organizationID,
    UserID:         userID,
    Scopes:         []widgets.WidgetScope{widgets.UsersTableManage},
  },
)
```
