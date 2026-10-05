import type { OTelAnyValue } from './otel.types.js'

export type LogSeverity = 'trace' | 'debug' | 'info' | 'warn' | 'error'

// `Error` values are serialized as exception type, message, and stack trace.
export type LogAttributeValue = OTelAnyValue | Error

export type LogAttributes = Readonly<Record<string, LogAttributeValue>>

// Hex ids: 32 characters for traceId, 16 for spanId.
export type TraceContext = {
  traceId: string
  spanId: string
  traceFlags?: number
}

export type TraceContextProvider = () => TraceContext | undefined

// Trace fields come together or not at all; without them the traceContext provider applies.
export type LogOptions = { eventName?: string } & (
  TraceContext | { traceId?: never; spanId?: never; traceFlags?: never }
)

export type SamLoggerBatchOptions = {
  maxBatchSize?: number
  maxQueueSize?: number
  scheduledDelayMs?: number
  // 'reject-new' (default) rejects the new log; 'drop-oldest' evicts the oldest queued log.
  overflowStrategy?: 'reject-new' | 'drop-oldest'
}

export type SamLoggerRetryOptions = {
  // Total attempts including the first. Default 3.
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
}

export type SamLoggerScope = {
  name?: string
  version?: string
  attributes?: LogAttributes
  schemaUrl?: string
}

export type SamLoggerLimits = {
  // Default 128. Excess attributes are dropped and counted in droppedAttributesCount.
  attributeCountLimit?: number
  // Default unlimited. Longer string attribute values are truncated.
  attributeValueLengthLimit?: number
  // Default 20. Deeper nested values are replaced with a placeholder string.
  maxValueDepth?: number
}

export type SamDiagnosticEvent =
  | { type: 'export-failed'; error: unknown; recordCount: number }
  | {
      type: 'partial-success'
      rejectedLogRecords: number
      errorMessage?: string
    }
  | { type: 'records-dropped'; reason: 'queue-full'; totalDropped: number }

export type SamLoggerOptions = {
  endpoint: string
  serviceName: string
  serviceVersion?: string
  resourceAttributes?: LogAttributes
  headers?: Readonly<Record<string, string>>
  batch?: SamLoggerBatchOptions
  fetcher?: typeof fetch
  keepalive?: boolean
  // Default true. Adds telemetry.sdk.*, user_agent.original, and browser.* attributes.
  detectResource?: boolean
  scope?: SamLoggerScope
  resourceSchemaUrl?: string
  // Default 'none'. Falls back to uncompressed where CompressionStream is missing.
  compression?: 'none' | 'gzip'
  // Per-attempt request timeout. Default 10000; 0 disables.
  timeoutMs?: number
  // Default retries up to 3 attempts; false disables.
  retry?: SamLoggerRetryOptions | false
  limits?: SamLoggerLimits
  traceContext?: TraceContextProvider
  onDiagnostic?: (event: SamDiagnosticEvent) => void
}
