import type { OTelAnyValue, OTelAttributes } from './otel.types.js'

export type LogSeverity = 'trace' | 'debug' | 'info' | 'warn' | 'error'

export type LogAttributeValue = OTelAnyValue

export type LogAttributes = Readonly<OTelAttributes>

export interface SamLoggerBatchOptions {
  maxBatchSize?: number
  maxQueueSize?: number
  scheduledDelayMs?: number
}

export interface SamLoggerOptions {
  endpoint: string
  serviceName: string
  serviceVersion?: string
  resourceAttributes?: LogAttributes
  headers?: Readonly<Record<string, string>>
  batch?: SamLoggerBatchOptions
  fetcher?: typeof fetch
}
