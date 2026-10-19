# React/TypeScript Standards

- Extract the widget into its own component file; the page imports and renders it rather than embedding widget logic inline.
- Keep server state in one place (the query/cache layer or explicit request state) and reuse shared domain types for API responses.
