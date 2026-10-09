# Framework: PHP

Use the official WorkOS PHP SDK for PHP apps (for example Laravel/Symfony) that create widget tokens and integrate widget APIs. Place token generation in existing controller/service boundaries.

## Token Pattern

```php
<?php

use WorkOS\Resource\WidgetScope;

WorkOS\WorkOS::setApiKey($_ENV['WORKOS_API_KEY']);

$widgets = new WorkOS\Widgets();
$token_response = $widgets->getToken(
    organization_id: $organizationId,
    user_id: $userId,
    scopes: [WidgetScope::UsersTableManage]
);
```
