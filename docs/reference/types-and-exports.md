---
sidebar_position: 3
title: Types and exports
---

# Types and exports

Everything is exported from the package root:

```ts
import { createSomLogger } from 'som-otel'
import type { SomLoggerOptions } from 'som-otel'
```

## Values

| Export                | Description                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `createSomLogger`     | Factory returning a `SomLogger`. The only way to create a logger.                          |
| `OtlpExportError`     | Error thrown for export failures, with `status`, `retryable`, and `retryAfterMs`.          |
| `OtlpHttpExporter`    | Low-level transport. See [Logger API](./logger-api.md#otlphttpexporter).                   |
| `traceContextFromApi` | Adapter for `@opentelemetry/api`. See [Trace correlation](../guides/trace-correlation.md). |
| `OTelSeverityNumber`  | Constant object with the OTel severity numbers (`UNSPECIFIED` to `FATAL4`).                |
| `OTelLogRecordFlags`  | Constants for log record flags (`TRACE_FLAGS_MASK`).                                       |

### `OTelSeverityNumber`

| Group | Names and numbers                                 |
| ----- | ------------------------------------------------- |
| unset | `UNSPECIFIED` 0                                   |
| trace | `TRACE` 1, `TRACE2` 2, `TRACE3` 3, `TRACE4` 4     |
| debug | `DEBUG` 5, `DEBUG2` 6, `DEBUG3` 7, `DEBUG4` 8     |
| info  | `INFO` 9, `INFO2` 10, `INFO3` 11, `INFO4` 12      |
| warn  | `WARN` 13, `WARN2` 14, `WARN3` 15, `WARN4` 16     |
| error | `ERROR` 17, `ERROR2` 18, `ERROR3` 19, `ERROR4` 20 |
| fatal | `FATAL` 21, `FATAL2` 22, `FATAL3` 23, `FATAL4` 24 |

The type `OTelSeverityNumber` is the union of these numbers.

## Option types

| Type                      | Used for                                          |
| ------------------------- | ------------------------------------------------- |
| `SomLogger`               | The type of the logger `createSomLogger` returns. |
| `SomLoggerOptions`        | The argument of `createSomLogger`.                |
| `SomLoggerBatchOptions`   | `batch`.                                          |
| `SomLoggerRetryOptions`   | `retry`.                                          |
| `SomLoggerScope`          | `scope`.                                          |
| `SomLoggerLimits`         | `limits`.                                         |
| `TraceContext`            | The value a `traceContext` provider returns.      |
| `TraceContextProvider`    | The type of `traceContext`.                       |
| `SomDiagnosticEvent`      | The argument of `onDiagnostic`.                   |
| `OtlpHttpExporterOptions` | Options of `OtlpHttpExporter`.                    |
| `OTelApiLike`             | Argument of `traceContextFromApi`.                |

## Log types

| Type                | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `LogSeverity`       | `'trace' \| 'debug' \| 'info' \| 'warn' \| 'error'`.     |
| `LogAttributeValue` | Any supported value, including `Error`.                  |
| `LogAttributes`     | Read-only map of attribute names to `LogAttributeValue`. |
| `LogOptions`        | Optional trace fields and `eventName` for a log call.    |
| `OtlpLogRecord`     | A log record in OTLP/JSON shape.                         |

## OpenTelemetry data types

These mirror the OpenTelemetry logs data model and are exported for `logRecord()` and for typing your own code.

| Type                                                           | Description                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `OTelLogRecord`                                                | The record accepted by `logRecord()`.                                                            |
| `OTelApplicationLog`, `OTelEvent`, `OTelSimpleLog`             | Narrowed `OTelLogRecord` shapes.                                                                 |
| `OTelAnyValue`, `OTelAttributes`                               | The value model.                                                                                 |
| `OTelResource`, `OTelInstrumentationScope`                     | Resource and scope.                                                                              |
| `OTelScopeLogs`, `OTelResourceLogs`, `OTelLogsData`            | Request structure with native types (`bigint` timestamps).                                       |
| `OTelJson…` types                                              | The same structure in its JSON wire form (string timestamps, `stringValue`/`intValue` wrappers). |
| `OTelTraceId`, `OTelSpanId`, `OTelTraceFlags`, `OTelTimestamp` | Aliases for ids, flags, and timestamps.                                                          |
