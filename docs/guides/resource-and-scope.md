---
sidebar_position: 9
title: Resource and scope
---

# Resource and scope

OTLP groups log records by **resource** (who produced them) and **instrumentation scope** (which library or module produced them). Som sends one resource and one scope per request.

## Resource attributes

The resource is built from, in increasing priority:

1. Detected browser attributes (below).
2. Your `resourceAttributes`.
3. `service.name` from `serviceName`, and `service.version` from `serviceVersion`.

```ts
const logger = createSomLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  serviceVersion: '2.1.0',
  resourceAttributes: {
    'deployment.environment.name': 'production',
  },
})
```

### Browser detection

By default Som adds attributes that describe the SDK and the browser:

| Attribute                | Value                                               |
| ------------------------ | --------------------------------------------------- |
| `telemetry.sdk.name`     | `som-otel`                                          |
| `telemetry.sdk.language` | `webjs`                                             |
| `user_agent.original`    | `navigator.userAgent`                               |
| `browser.language`       | `navigator.language`                                |
| `browser.brands`         | `['Chromium 120', …]`, from User-Agent Client Hints |
| `browser.mobile`         | `true` or `false`, from User-Agent Client Hints     |
| `browser.platform`       | Platform name, from User-Agent Client Hints         |

The `browser.*` attributes from client hints appear only in browsers that expose `navigator.userAgentData`. `telemetry.sdk.version` is not set.

Anything you set in `resourceAttributes` replaces the detected value with the same name.

Turn detection off to send only your own attributes:

```ts
createSomLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  detectResource: false,
})
```

:::tip Privacy

`user_agent.original` is sent with every request. If you do not want it, set `detectResource: false` and add only the attributes you need.

:::

## Instrumentation scope

Records are sent under the scope `som` by default. Use `scope` to name your own:

```ts
const logger = createSomLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  scope: {
    name: 'storefront-web',
    version: '2.1.0',
    attributes: { area: 'checkout' },
  },
})
```

| Field        | Default | Notes                              |
| ------------ | ------- | ---------------------------------- |
| `name`       | `'som'` |                                    |
| `version`    | unset   | Omitted from the request if unset  |
| `attributes` | unset   | Same value types as log attributes |
| `schemaUrl`  | unset   | Schema URL of the scope            |

## Schema URLs

Schema URLs tell the backend which version of the semantic conventions your attribute names follow. Set one for the scope with `scope.schemaUrl` and one for the resource with `resourceSchemaUrl`:

```ts
const logger = createSomLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  scope: { schemaUrl: 'https://opentelemetry.io/schemas/1.27.0' },
  resourceSchemaUrl: 'https://opentelemetry.io/schemas/1.27.0',
})
```

Both are omitted from the request when unset.
