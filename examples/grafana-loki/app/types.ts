import type { OTelAnyValue } from 'sam-otel'

export const severities = ['debug', 'info', 'warn', 'error', 'fatal'] as const

export type Severity = (typeof severities)[number]

export type SendState = 'sending' | 'sent' | 'failed'

export type LogAttributes = Record<string, OTelAnyValue>

export type SentLog = {
  id: number
  severity: Severity
  body: string
  at: Date
  state: SendState
  detail?: string
}

export type SendLog = (
  severity: Severity,
  body: string | Error,
  attributes?: LogAttributes,
) => Promise<void>
