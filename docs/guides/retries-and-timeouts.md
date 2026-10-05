---
sidebar_position: 7
title: Retries and timeouts
---

# Retries and timeouts

Sam retries failed exports before it rejects your log promises.

## What is retried

| Failure                                                  | Retried? |
| -------------------------------------------------------- | -------- |
| Network error, CORS failure, DNS error                   | Yes      |
| Request timeout                                          | Yes      |
| HTTP `429`, `502`, `503`, `504`                          | Yes      |
| Any other HTTP error, such as `400`, `401`, `404`, `500` | No       |

These are the statuses the OTLP/HTTP specification defines as retryable. Other errors mean the request itself is wrong, so sending it again would not help.

## Backoff

Between attempts Sam waits with **exponential backoff and jitter**. The delay before retry `n` (starting at 1) is between half of and the full value of `min(maxDelayMs, initialDelayMs × backoffMultiplier^(n - 1))`.

With the defaults that is about 0.5–1 s before the first retry and 1–2 s before the second.

If the collector sends a `Retry-After` header (seconds or an HTTP date), Sam waits exactly that long instead. If the requested pause is longer than `retry.maxDelayMs`, Sam does not wait on it and gives up.

## Configuring retries

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

The values above are the defaults, and every field is optional.

| Option              | Default | Meaning                                          |
| ------------------- | ------- | ------------------------------------------------ |
| `maxAttempts`       | `3`     | Total attempts including the first one.          |
| `initialDelayMs`    | `1000`  | Base delay before the first retry.               |
| `maxDelayMs`        | `30000` | Cap for backoff, and for honoring `Retry-After`. |
| `backoffMultiplier` | `2`     | Growth factor between retries.                   |

Set `retry: false` to make a single attempt.

## Timeouts

`timeoutMs` (default `10000`) limits **each attempt**. When it expires Sam aborts the request through an `AbortSignal` and treats it as a retryable failure. Set `timeoutMs: 0` to disable the timeout.

Because a flush waits for its retries, an unreachable collector delays the next batch by up to `maxAttempts` timeouts plus backoff. Lower `timeoutMs` or `maxAttempts` if you need to fail faster; the [queue](./batching.md#queue-overflow) absorbs logs in the meantime.

## When retries run out

The log promises of the failed batch reject with the **last** error, and `onDiagnostic` receives an `export-failed` event. The records are not kept: Sam does not retry beyond `maxAttempts`, and retries only cover the current page session.

## `OtlpExportError`

Export failures reject with an `OtlpExportError`:

| Property       | Meaning                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`      | `OTLP log request failed: 503 Service Unavailable`, or `OTLP log request timed out after 10000ms`. Network errors keep their original message. |
| `status`       | HTTP status, when the collector answered.                                                                                                      |
| `retryable`    | Whether the failure type is retryable.                                                                                                         |
| `retryAfterMs` | The `Retry-After` delay in milliseconds, when present.                                                                                         |
| `cause`        | The original error for network failures.                                                                                                       |

```ts
import { OtlpExportError } from 'sam-otel'

try {
  await logger.error('Payment failed')
} catch (error) {
  if (error instanceof OtlpExportError && error.status === 401) {
    refreshToken()
  }
}
```

## Partial success

A collector can accept a request but reject some of its records, and still answer `200`. Sam never retries these, because the same records would be rejected again. It reports them as a `partial-success` [diagnostic](./diagnostics.md) with `rejectedLogRecords` and, when given, `errorMessage`. The log promises resolve.

Sam reads partial success from JSON responses (`Content-Type: application/json`).
