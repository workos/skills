# Framework: Java

Use the official WorkOS Java SDK for Java services/apps that issue widget tokens and support widget integrations. Place token creation in existing service/controller boundaries.

## Token Pattern

```java
import com.workos.WorkOS;
import com.workos.types.WidgetSessionTokenScopes;

// com.workos:workos 7.x
WorkOS workos = new WorkOS(System.getenv("WORKOS_API_KEY"));

String token = workos.getWidgets()
    .createToken(organizationId, userId, List.of(WidgetSessionTokenScopes.WidgetsUsersTableManage))
    .getToken();
```
