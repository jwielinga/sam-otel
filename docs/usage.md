# Sam User Guide

Sam is a browser-side TypeScript SDK that sends OpenTelemetry log records to an OTLP/HTTP collector. It has no UI and does not collect logs automatically; application code chooses what to log.

## Install

Sam's npm package name is `sam-otel`. Until its first release is published, try it from a local checkout:

1. Build the package in the Sam repository:

   ```sh
   pnpm install
   pnpm build
   ```

2. From the consuming application, add the local repository path. For a sibling app and `sam-otel` checkout:

   ```sh
   pnpm add ../sam-otel
   ```

After the first release, install the published package with:

```sh
pnpm add sam-otel
```

## Configure

Pass the complete OTLP/HTTP logs URL to `endpoint`; Sam does not append `/v1/logs` for you.

```ts
import { createSamLogger } from 'sam-otel'

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

`endpoint` and `serviceName` are required. All other options are optional and described below. Sam adds `service.name` to resource attributes from `serviceName`; it adds `service.version` when provided.

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
import { OTelSeverityNumber } from 'sam-otel'

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

Helper-made records set both `timeUnixNano` and `observedTimeUnixNano` to the current time with sub-millisecond precision. `logRecord()` fills `observedTimeUnixNano` when you leave it out.

### Errors

Pass an `Error` as the body and Sam logs `error.message` as the body and adds `exception.type`, `exception.message`, and `exception.stacktrace` attributes. Attributes you pass with the same names win. An `Error` used as an attribute value becomes a map with `type`, `message`, and `stacktrace`.

```ts
try {
  await checkout()
} catch (error) {
  if (error instanceof Error) await logger.error(error, { orderId: 'order-42' })
}
```

### Trace correlation

Pass trace fields in the optional last argument of `log()` and the severity helpers:

```ts
await logger.info(
  'Checkout completed',
  { orderId: 'order-42' },
  { traceId, spanId, traceFlags: 1, eventName: 'checkout.completed' },
)
```

To correlate every log with the active span, set `traceContext`. With `@opentelemetry/api`, use the `traceContextFromApi` helper:

```ts
import { context, trace } from '@opentelemetry/api'
import { createSamLogger, traceContextFromApi } from 'sam-otel'

const logger = createSamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  traceContext: traceContextFromApi({ trace, context }),
})
```

`traceContext` is any function returning `{ traceId, spanId, traceFlags? }` or `undefined`. Explicit ids always win over it. The types require `traceId` and `spanId` together; Sam does not validate their format, so pass lowercase hex (32 characters for `traceId`, 16 for `spanId`). `logRecord()` accepts the same fields on the record and uses the provider when it has neither `traceId` nor `spanId`. `traceFlags` is sent as the record `flags` field, limited to its low 8 bits.

## Keepalive and Page Unload

Sam sets the Fetch `keepalive` flag on export requests so the browser can finish sending queued logs while a page unloads. It is on by default; set `keepalive: false` to turn it off.

```ts
const logger = createSamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  keepalive: false,
})
```

Sam also flushes queued logs when the page fires `pagehide` or becomes hidden (`visibilitychange`). This flush starts its requests immediately, even if an earlier request is still in flight, and never compresses, retries, or waits on timeouts. Where `keepalive` is supported, Sam splits a batch into several requests so each one fits the 64 KiB browser limit. `shutdown()` removes the listeners.

Sam only sets `keepalive` when the browser supports it; otherwise it sends plain requests, which the browser may cancel during unload.
Sam cannot send a `Connection: keep-alive` header: browsers forbid scripts from setting `Connection`, and HTTP/2 and HTTP/3 do not allow it. Browsers already reuse connections on their own, so the flag above is the only browser-level control.

Browser limits:

- Browsers without Fetch `keepalive` support (for example Firefox before 133, and very old Chrome and Safari) ignore the flag. Sam detects support and sends normal requests, so unload delivery is not guaranteed there.
- Browsers cap in-flight keepalive request bodies at 64 KiB. Sam omits the flag for larger normal batches, and splits unload batches. A single record over the limit is sent without `keepalive`.
- Keepalive requests with custom headers such as `Authorization` trigger a CORS preflight. The collector must answer it, and the browser may not complete the preflight if the page is already closing.

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

The timer starts when the first record enters an empty batch; later records do not reset it. `maxBatchSize` caps records per request. Records queued while a request is in flight are sent in subsequent batches. `maxQueueSize` limits records waiting for a request, excluding the in-flight batch. By default, when the pending queue is full, new log calls reject with `SamLogger batch queue is full.` and existing queued records are kept. Set `batch.overflowStrategy: 'drop-oldest'` to evict the oldest queued record instead; its promise rejects with `SamLogger batch queue is full; oldest record dropped.` Either way, `logger.droppedRecordCount` counts dropped records and `onDiagnostic` receives a `records-dropped` event.

Call `flush()` to send queued records immediately. Call `shutdown()` when the logger is no longer needed; it stops accepting new logs and flushes queued records. Both return promises and reject when export fails. Queued records live in memory, so they are lost if the page closes without a flush; the page-hide flush above covers normal navigation.

## Retries and Timeouts

Sam retries failed exports before rejecting the log promises. A request is retried when it fails at the network level, times out, or the collector answers `429`, `502`, `503`, or `504`. Other statuses (such as `400`) fail immediately. Retries use exponential backoff with jitter and honor `Retry-After` (seconds or HTTP date). If `Retry-After` is longer than `retry.maxDelayMs`, Sam stops retrying.

```ts
const logger = createSamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  timeoutMs: 10_000,
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1_000,
    maxDelayMs: 30_000,
    backoffMultiplier: 2,
  },
})
```

The values above are the defaults. `retry: false` makes a single attempt. `timeoutMs` applies to each attempt and aborts the request through an `AbortSignal`; `0` disables it. Because a flush waits for its retries, a failing collector delays later batches by up to `maxAttempts` timeouts plus backoff.

Export failures reject with an `OtlpExportError` that has `status`, `retryable`, and `retryAfterMs`. Network errors keep their original message and set `cause`.

The collector can accept a request but reject some records. Sam does not retry these. It reports them as a `partial-success` diagnostic with `rejectedLogRecords` and `errorMessage` (JSON responses).

## Diagnostics

Background failures do not surface through any promise. Set `onDiagnostic` to observe them:

```ts
const logger = createSamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  onDiagnostic(event) {
    if (event.type === 'export-failed') console.warn(event.error)
  },
})
```

Events: `export-failed` (`error`, `recordCount`), `partial-success`, `records-dropped` (`totalDropped`). A throwing callback is ignored.

## Payload Options

**Scope and schema URLs.** Records are sent under the instrumentation scope `sam` by default. Set `scope` to change it, and `resourceSchemaUrl` for the resource:

```ts
const logger = createSamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  scope: {
    name: 'storefront-web',
    version: '2.1.0',
    attributes: { area: 'checkout' },
    schemaUrl: 'https://opentelemetry.io/schemas/1.27.0',
  },
  resourceSchemaUrl: 'https://opentelemetry.io/schemas/1.27.0',
})
```

**Resource detection.** By default Sam adds `telemetry.sdk.name`, `telemetry.sdk.language`, `user_agent.original`, `browser.language`, `browser.brands`, `browser.mobile`, `browser.platform` (when the browser exposes them). Your `resourceAttributes` override detected values; set `detectResource: false` to turn detection off. `telemetry.sdk.version` is not set.

**Compression.** `compression: 'gzip'` compresses the body with `CompressionStream` and sets `Content-Encoding: gzip`. Browsers without `CompressionStream` send uncompressed. Page-unload requests are never compressed. The collector must accept gzip request bodies.

**Limits.** Attributes are bounded to protect the collector and the 64 KiB unload budget:

```ts
const logger = createSamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  limits: {
    attributeCountLimit: 128,
    attributeValueLengthLimit: 4096,
    maxValueDepth: 20,
  },
})
```

`attributeCountLimit` (default `128`) drops extra attributes and adds them to `droppedAttributesCount`. `attributeValueLengthLimit` (default unlimited) truncates string attribute values, including strings inside arrays and maps; log bodies are not truncated. Values nested deeper than `maxValueDepth` (default `20`) and circular references are replaced with the strings `[MaxDepthExceeded]` and `[Circular]`.

## Collector Requirements

The collector must accept OTLP/HTTP log requests at the configured endpoint, as JSON (gzip too when you enable it). For browser calls, its CORS policy must allow the application origin, `POST`/`OPTIONS`, and request headers used by the SDK, including `Content-Type`, `Content-Encoding` when compressing, and any custom headers such as `Authorization`.

Use HTTPS in production. Browser requests are subject to normal network, CORS, and content-security-policy rules.

## Current Limits

- Batching is always enabled; each HTTP request contains up to 20 log records by default.
- Records stay in memory until count threshold, timer, `flush()`, `shutdown()`, or page hide triggers export.
- Retries cover a single page session; records that exhaust their retries are lost.
- Without `overflowStrategy: 'drop-oldest'`, new log calls reject once `maxQueueSize` is reached during an in-flight export.
- Non-success HTTP responses reject the call; network, CORS, and timeout errors reject through an `OtlpExportError`.
- Logs only: no traces or metrics, and no automatic capture of console output, errors, or navigation.
