# Sam User Guide

Sam is a browser-side TypeScript SDK that sends OpenTelemetry log records to an OTLP/HTTP collector. It has no UI and does not collect logs automatically; application code chooses what to log.

## Install

Sam is private and not published to the npm registry yet. To try it from a local checkout:

1. Build the package in the Sam repository:

   ```sh
   pnpm install
   pnpm build
   ```

2. From the consuming application, add the local repository path. For a sibling app and `sam` checkout:

   ```sh
   pnpm add ../sam
   ```

After Sam is published, install the published package with:

```sh
pnpm add sam
```

## Configure

Pass the complete OTLP/HTTP logs URL to `endpoint`; Sam does not append `/v1/logs` for you.

```ts
import { createSamLogger } from 'sam'

const logger = createSamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  serviceVersion: '1.0.0',
  resourceAttributes: {
    'deployment.environment.name': 'production',
    'service.namespace': 'commerce',
  },
})
```

`endpoint` and `serviceName` are required. `serviceVersion`, `resourceAttributes`, `headers`, and `fetcher` are optional. Sam adds `service.name` to resource attributes from `serviceName`; it adds `service.version` when provided.

`createSamLogger(options)` is the recommended SDK factory. `new SamLogger(options)` is also supported.

Use `headers` for collector request headers when needed:

```ts
const logger = new SamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  headers: {
    Authorization: `Bearer ${shortLivedUserToken}`,
  },
})
```

Browser code is visible to users. Do not put shared secrets or server credentials in the bundle. Treat log bodies and attributes as client-visible data.

## Write Logs

Use severity helpers or the generic `log` method:

```ts
await logger.trace('Cache lookup started', { key: 'homepage' })
await logger.debug('Cache lookup completed', { hit: true })
await logger.info('Checkout completed', { orderId: 'order-42', total: 12.5 })
await logger.warn('Inventory is low', { sku: 'sku-7', remaining: 2 })
await logger.error('Payment failed', { orderId: 'order-42', retryable: false })

await logger.log('info', 'User signed in', { userId: 'user-123' })
```

Each call returns a `Promise<void>`. Await it when the caller needs to observe export failures. Attribute and body values use the OpenTelemetry `AnyValue` model: strings, booleans, numbers, `bigint` signed 64-bit integers, `Uint8Array` bytes, arrays, and nested maps. JavaScript numbers serialize as OTLP doubles; use `bigint` when integer precision matters.

Use `logRecord()` when a record needs explicit timestamps, OTel severity number/text, trace/span correlation, flags, dropped-attribute count, or event name:

```ts
import { OTelSeverityNumber } from 'sam'

await logger.logRecord({
  timeUnixNano: BigInt(Date.now()) * 1_000_000n,
  severityNumber: OTelSeverityNumber.ERROR,
  severityText: 'ERROR',
  body: { message: 'Payment failed', retryable: false },
  attributes: { orderId: 'order-42' },
  traceId: '5B8EFFF798038103D269B633813FC60C',
  spanId: 'EEE19B7EC3C1B174',
  eventName: 'payment.failed',
})
```

```ts
try {
  await logger.info('Profile updated', { userId: 'user-123' })
} catch (error) {
  console.error('Could not export log record', error)
}
```

The `fetcher` option can replace browser `fetch` for tests or custom environments. It must follow the standard Fetch API signature.

## Batch Logs

Batching is always enabled. Sam sends records when the batch reaches 20 logs or 5 seconds pass after the first pending log. Set `batch` options to change those thresholds:

```ts
const logger = new SamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  batch: {
    maxBatchSize: 50,
    maxQueueSize: 1_000,
    scheduledDelayMs: 2_000,
  },
})
```

`maxBatchSize` defaults to `20`; `maxQueueSize` defaults to `1000` pending records; `scheduledDelayMs` defaults to `5000`. Set these values to tune request size, queue capacity, and maximum normal wait. Timer delay must be between `0` and `2147483647` milliseconds. Each log call's promise resolves when its containing batch succeeds and rejects if export fails. A count-triggered or timer-triggered flush sends one OTLP/HTTP request containing multiple log records.

The timer starts when the first record enters an empty batch; later records do not reset it. `maxBatchSize` caps records per request. Records queued while a request is in flight are sent in subsequent batches. `maxQueueSize` limits records waiting for a request, excluding the in-flight batch. When the pending queue is full, new log calls reject with `SamLogger batch queue is full.`; existing queued records are kept.

Call `flush()` to send queued records immediately. Call `shutdown()` when the logger is no longer needed; it stops accepting new logs and flushes queued records. Both return promises and reject when export fails. Batching is in-memory only, so queued records can be lost if the page closes before a timer or explicit flush sends them. Use `navigator.sendBeacon` or a server-side exporter for unload-critical delivery; Sam does not provide unload guarantees.

## Collector Requirements

The collector must accept OTLP/HTTP JSON log requests at the configured endpoint. For browser calls, its CORS policy must allow the application origin, `POST`/`OPTIONS`, and request headers used by the SDK, including `Content-Type` and any custom headers such as `Authorization`.

Use HTTPS in production. Browser requests are subject to normal network, CORS, and content-security-policy rules.

## Current Limits

- Batching is always enabled; each HTTP request contains up to 20 log records by default.
- Records stay in memory until count threshold, timer, `flush()`, or `shutdown()` triggers export.
- Retries and offline delivery are not implemented.
- When `maxQueueSize` is reached during an in-flight export, new log calls reject instead of growing the queue or dropping older records.
- Non-success HTTP responses reject the call; network and CORS errors reject through `fetch`.
