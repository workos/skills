# Styling and Components

Match widget UI to the host application's existing styling and component systems.

- Don't override a component's built-in styling by passing `className` or `style` to it. Use `<Button>` as-is (never `<Button className="bg-red-500">`); customize through its own props (`variant`, `size`, etc.).
- The packaged `<WorkOsWidgets>` components own their styling through the provider; customize via the provider's own props rather than external CSS.
