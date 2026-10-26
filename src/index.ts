export { OtlpExportError, OtlpHttpExporter } from './http-exporter.js'
export type { OtlpHttpExporterOptions } from './http-exporter.js'
export { createSomLogger } from './sdk.js'
export type { SomLogger } from './logger.js'
export { traceContextFromApi } from './trace-context.js'
export type { OTelApiLike } from './trace-context.js'
export * from './otel.types.js'
export type { OtlpLogRecord } from './otlp.js'
export type {
  LogAttributes,
  LogAttributeValue,
  LogOptions,
  LogSeverity,
  SomDiagnosticEvent,
  SomLoggerBatchOptions,
  SomLoggerLimits,
  SomLoggerOptions,
  SomLoggerRetryOptions,
  SomLoggerScope,
  TraceContext,
  TraceContextProvider,
} from './sdk.types.js'
