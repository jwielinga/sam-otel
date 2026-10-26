---
sidebar_position: 1
title: Configuration
---

# Configuration

Create a logger with `createSomLogger(options)`.

```ts
import { createSomLogger } from 'som-otel'

const logger = createSomLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  serviceVersion: '1.0.0',
  resourceAttributes: {
    'deployment.environment.name': 'production',
    'service.namespace': 'commerce',
  },
})
```

Only `endpoint` and `serviceName` are required. Every other option has a default; the [options reference](../reference/options.md) lists them all.

## Endpoint

`endpoint` is the complete URL of the collector's OTLP/HTTP logs receiver, for example `https://collector.example.com/v1/logs`. Som posts to exactly this URL and never adds a path. Use HTTPS in production.

## Service identity

| Option           | Resource attribute | Notes                                |
| ---------------- | ------------------ | ------------------------------------ |
| `serviceName`    | `service.name`     | Required. Cannot be empty.           |
| `serviceVersion` | `service.version`  | Optional. Omitted when not provided. |

`service.name` and `service.version` always come from these options. If you also pass them in `resourceAttributes`, the dedicated options win.

## Resource attributes

`resourceAttributes` describes the entity that produces the logs. Every request carries these attributes once on the resource, not on each record:

```ts
resourceAttributes: {
  'deployment.environment.name': 'production',
  'service.namespace': 'commerce',
}
```

Values use the same [value types](./writing-logs.md#attribute-values) as log attributes. Som also adds browser attributes by default; see [Resource and scope](./resource-and-scope.md).

## Request headers

Use `headers` for headers the collector expects on every request, such as authorization:

```ts
const logger = createSomLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  headers: {
    Authorization: `Bearer ${shortLivedUserToken}`,
  },
})
```

Your headers are added after Som's own `Content-Type` (and `Content-Encoding` when compressing), so a header you set can override those.

:::warning Everything in the bundle is public

Browser code is visible to every user. Never put shared secrets or server credentials in `headers`, `resourceAttributes`, or log attributes. Use short-lived, narrowly scoped tokens, and treat all log content as client-visible.

:::

Custom headers make the browser send a CORS preflight request. The collector must allow them; see [Collector setup](./collector-setup.md).

## Custom fetch

`fetcher` replaces the global `fetch`. Use it for tests, for instrumented fetch implementations, or in environments without a global `fetch`:

```ts
const logger = createSomLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  fetcher: myFetch,
})
```

It must follow the standard Fetch API signature and return a `Response`. See [Testing](./testing.md).

## Construction errors

Som validates a few things when you create the logger and throws a `TypeError` immediately:

| Problem                            | Message                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Empty `endpoint`                   | `endpoint must be a non-empty string.`                                    |
| Empty `serviceName`                | `serviceName must be a non-empty string.`                                 |
| No global `fetch` and no `fetcher` | `fetch is not available in this environment; provide the fetcher option.` |

Other options are not validated at runtime. Rely on the TypeScript types for them.
