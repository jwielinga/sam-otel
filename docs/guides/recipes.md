---
sidebar_position: 14
title: Recipes
---

# Recipes

## One shared logger

Create the logger once in its own module and import it everywhere:

```ts title="logger.ts"
import { createSomLogger } from 'som-otel'

export const logger = createSomLogger({
  endpoint: import.meta.env.VITE_LOGS_ENDPOINT,
  serviceName: 'storefront',
  serviceVersion: import.meta.env.VITE_APP_VERSION,
  resourceAttributes: {
    'deployment.environment.name': import.meta.env.MODE,
  },
})
```

One logger means one queue and one set of batches. Creating a logger per component multiplies requests and page listeners.

## Fire-and-forget logging

Most log calls do not need `await`. But if an export fails, the returned promise rejects, and an un-awaited rejection shows up as an unhandled promise rejection. Add a handler that does nothing, or reports elsewhere:

```ts
void logger.info('Button clicked', { id: 'buy' }).catch(() => {})
```

To avoid repeating this, wrap it once and use [`onDiagnostic`](./diagnostics.md) to observe failures:

```ts
export function log(message: string, attributes?: Record<string, string>) {
  void logger.info(message, attributes).catch(() => {})
}
```

## Capture uncaught errors

Som does not install global handlers. Register your own to send uncaught errors and unhandled rejections:

```ts
window.addEventListener('error', (event) => {
  void logger
    .error(event.error ?? event.message, {
      'code.filepath': event.filename,
      'code.lineno': event.lineno,
    })
    .catch(() => {})
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  void logger
    .error(reason instanceof Error ? reason : String(reason), {
      'event.kind': 'unhandledrejection',
    })
    .catch(() => {})
})
```

An `Error` gets `exception.*` attributes automatically. See [Logging errors](./logging-errors.md). The `.catch` also prevents Som's own export failures from raising new `unhandledrejection` events, which would otherwise log recursively.

## Forward `console` output

Wrap the console methods you care about:

```ts
const originalWarn = console.warn

console.warn = (...args: unknown[]) => {
  originalWarn(...args)
  void logger.warn(args.map(String).join(' ')).catch(() => {})
}
```

## Add context to every log

Som has no per-logger default attributes. Put stable context in `resourceAttributes`, or wrap the logger:

```ts
export const checkoutLog = {
  info: (message: string, attributes: Record<string, string> = {}) =>
    logger.info(message, { 'app.area': 'checkout', ...attributes }),
}
```

## Correlate with the active span

If you use OpenTelemetry tracing, set `traceContext` once and every log carries the active trace. See [Trace correlation](./trace-correlation.md#with-opentelemetryapi).

## Send a final log before leaving

For a single important event right before navigation, await it or flush:

```ts
await logger.info('Checkout completed', { orderId })
window.location.assign('/thank-you')
```

For everything else, Som's [page-hide flush](./page-unload.md) already runs.
