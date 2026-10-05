export { OtlpExportError, OtlpHttpExporter } from './http-exporter.js'
export type { OtlpHttpExporterOptions } from './http-exporter.js'
export { SamLogger, createSamLogger } from './sdk.js'
export { traceContextFromApi } from './trace-context.js'
export type { OTelApiLike } from './trace-context.js'
export * from './otel.types.js'
export type { OtlpLogRecord } from './otlp.js'
export type {
  LogAttributes,
  LogAttributeValue,
  LogOptions,
  LogSeverity,
  SamDiagnosticEvent,
  SamLoggerBatchOptions,
  SamLoggerLimits,
  SamLoggerOptions,
  SamLoggerRetryOptions,
  SamLoggerScope,
  TraceContext,
  TraceContextProvider,
} from './sdk.types.js'
