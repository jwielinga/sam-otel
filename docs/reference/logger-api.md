---
sidebar_position: 2
title: Logger API
---

# Logger API

`createSomLogger(options)` returns a `SomLogger`, the logger you call everything on. `SomLogger` is exported as a type only, for annotating variables and parameters.

```ts
import { createSomLogger, type SomLogger } from 'som-otel'
```

## Severity helpers

```ts
logger.trace(body, attributes?, options?): Promise<void>
logger.debug(body, attributes?, options?): Promise<void>
logger.info(body, attributes?, options?): Promise<void>
logger.warn(body, attributes?, options?): Promise<void>
logger.error(body, attributes?, options?): Promise<void>
```

| Parameter    | Type                | Description                                                                 |
| ------------ | ------------------- | --------------------------------------------------------------------------- |
| `body`       | `LogAttributeValue` | Any [value type](../guides/writing-logs.md#attribute-values) or an `Error`. |
| `attributes` | `LogAttributes`     | Optional map of attribute names to values.                                  |
| `options`    | `LogOptions`        | Optional trace fields and event name.                                       |

## `log()`

```ts
logger.log(severity, body, attributes?, options?): Promise<void>
```

`severity` is `'trace' | 'debug' | 'info' | 'warn' | 'error'`. The helpers call `log()` with their name.

## `logRecord()`

```ts
logger.logRecord(record: OTelLogRecord): Promise<void>
```

Sends a record with full control over timestamps, severity number and text, trace fields, flags, and event name. See [Raw records](../guides/writing-logs.md#raw-records-with-logrecord).

## `flush()`

```ts
logger.flush(): Promise<void>
```

Sends all queued records now. Resolves when the exports finish; rejects if one fails (an `AggregateError` if several fail).

## `shutdown()`

```ts
logger.shutdown(): Promise<void>
```

Stops accepting new logs, removes the page listeners, and flushes the queue. Later log calls reject with `SomLogger has been shut down.`

## `droppedRecordCount`

```ts
logger.droppedRecordCount: number
```

Number of records dropped because the queue was full. Read-only.

## Promise behavior

All log methods return a promise that:

- **resolves** when the batch containing the record is exported successfully,
- **rejects** with an [`OtlpExportError`](../guides/retries-and-timeouts.md#otlpexporterror) when the export fails,
- **rejects** with `SomLogger batch queue is full.` or `SomLogger batch queue is full; oldest record dropped.` on overflow,
- **rejects** with a `TypeError` when a value cannot be encoded (non-finite number, out-of-range `bigint`),
- **rejects** with `SomLogger has been shut down.` after `shutdown()`.

The record is queued synchronously when the method is called, so an immediate `flush()` or `shutdown()` includes it.

## `LogOptions`

The optional last argument of `log()` and the helpers:

```ts
type LogOptions = { eventName?: string } & (
  | { traceId: string; spanId: string; traceFlags?: number }
  | { traceId?: never; spanId?: never; traceFlags?: never }
)
```

`traceId` and `spanId` come together. See [Trace correlation](../guides/trace-correlation.md).

## `OtlpHttpExporter`

`OtlpHttpExporter` is the transport `SomLogger` uses internally, exported for advanced use. Most apps never need it. It sends log records that are already in OTLP/JSON shape (`OtlpLogRecord`), and supports the same `retry`, `timeoutMs`, `compression`, and `keepalive` options. Unlike `SomLogger`, it does not retry or time out unless you ask for it:

```ts
import { OtlpHttpExporter } from 'som-otel'

const exporter = new OtlpHttpExporter({
  endpoint: 'https://collector.example.com/v1/logs',
  resourceAttributes: { 'service.name': 'storefront' },
  fetcher: fetch,
})

await exporter.export(records) // OtlpLogRecord[]
```

It has no queue or batching, and does not detect resources. Its options are `OtlpHttpExporterOptions`.
