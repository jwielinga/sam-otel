import { nowUnixNano } from './clock.js'
import {
  OTelSeverityNumber,
  type OTelJsonAnyValue,
  type OTelJsonInstrumentationScope,
  type OTelJsonKeyValue,
  type OTelJsonLogRecord,
  type OTelJsonLogsData,
  type OTelJsonResourceLogs,
  type OTelLogRecord,
} from './otel.types.js'
import type {
  LogAttributes,
  LogAttributeValue,
  LogSeverity,
  SamLoggerLimits,
  SamLoggerScope,
} from './sdk.types.js'

export type OtlpLogRecord = OTelJsonLogRecord

export type OtlpLimits = Required<SamLoggerLimits>

export type OtlpRecordExtras = {
  traceId?: string
  spanId?: string
  flags?: number
  eventName?: string
}

export type OtlpRequestOptions = {
  scope?: SamLoggerScope
  resourceSchemaUrl?: string
}

type EncodeContext = {
  stringLimit: number
  maxDepth: number
  ancestors: object[]
}

const DEFAULT_SCOPE_NAME = 'sam'

export const DEFAULT_LIMITS: OtlpLimits = {
  attributeCountLimit: 128,
  attributeValueLengthLimit: Infinity,
  maxValueDepth: 20,
}

// Resource and scope attributes are developer-supplied, so only the depth guard applies.
const UNLIMITED_ATTRIBUTES: OtlpLimits = {
  ...DEFAULT_LIMITS,
  attributeCountLimit: Infinity,
}

const severityNumbers: Record<LogSeverity, OTelSeverityNumber> = {
  trace: OTelSeverityNumber.TRACE,
  debug: OTelSeverityNumber.DEBUG,
  info: OTelSeverityNumber.INFO,
  warn: OTelSeverityNumber.WARN,
  error: OTelSeverityNumber.ERROR,
}

const MIN_INT64 = -(1n << 63n)
const MAX_INT64 = (1n << 63n) - 1n

export function resolveLimits(limits: SamLoggerLimits = {}): OtlpLimits {
  return {
    attributeCountLimit:
      limits.attributeCountLimit ?? DEFAULT_LIMITS.attributeCountLimit,
    attributeValueLengthLimit:
      limits.attributeValueLengthLimit ??
      DEFAULT_LIMITS.attributeValueLengthLimit,
    maxValueDepth: limits.maxValueDepth ?? DEFAULT_LIMITS.maxValueDepth,
  }
}

function encodeBytes(value: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < value.length; offset += chunkSize) {
    binary += String.fromCharCode(...value.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text
  // Avoid cutting a surrogate pair in half.
  const lastCode = limit > 0 ? text.charCodeAt(limit - 1) : 0
  const end = lastCode >= 0xd800 && lastCode <= 0xdbff ? limit - 1 : limit
  return text.slice(0, end)
}

export function describeError(error: Error): {
  type: string
  message: string
  stacktrace?: string
} {
  const type =
    error.name !== 'Error' && error.name
      ? error.name
      : error.constructor?.name || 'Error'
  return {
    type,
    message: error.message,
    ...(error.stack ? { stacktrace: error.stack } : {}),
  }
}

function createContext(
  limits: OtlpLimits,
  truncateStrings: boolean,
): EncodeContext {
  return {
    stringLimit: truncateStrings ? limits.attributeValueLengthLimit : Infinity,
    maxDepth: limits.maxValueDepth,
    ancestors: [],
  }
}

function encodeValue(
  value: LogAttributeValue,
  key: string,
  context: EncodeContext,
  depth = 0,
): OTelJsonAnyValue {
  if (typeof value === 'string') {
    return { stringValue: truncate(value, context.stringLimit) }
  }
  if (typeof value === 'boolean') return { boolValue: value }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Log attribute "${key}" must be a finite number.`)
    }
    return { doubleValue: value }
  }

  if (typeof value === 'bigint') {
    if (value < MIN_INT64 || value > MAX_INT64) {
      throw new TypeError(`Log attribute "${key}" must fit in a signed int64.`)
    }
    return { intValue: value.toString() }
  }

  if (value instanceof Uint8Array) return { bytesValue: encodeBytes(value) }

  if (value instanceof Error) {
    const { type, message, stacktrace } = describeError(value)
    const fields: Array<[string, string]> = [
      ['type', type],
      ['message', message],
    ]
    if (stacktrace !== undefined) fields.push(['stacktrace', stacktrace])
    return {
      kvlistValue: {
        values: fields.map(([fieldKey, text]) => ({
          key: fieldKey,
          value: { stringValue: truncate(text, context.stringLimit) },
        })),
      },
    }
  }

  if (depth >= context.maxDepth) return { stringValue: '[MaxDepthExceeded]' }
  if (context.ancestors.includes(value)) return { stringValue: '[Circular]' }

  context.ancestors.push(value)
  try {
    if (Array.isArray(value)) {
      return {
        arrayValue: {
          values: value.map((item) =>
            encodeValue(item, key, context, depth + 1),
          ),
        },
      }
    }

    return {
      kvlistValue: {
        values: Object.entries(value).map(([nestedKey, nestedValue]) => ({
          key: nestedKey,
          value: encodeValue(
            nestedValue,
            `${key}.${nestedKey}`,
            context,
            depth + 1,
          ),
        })),
      },
    }
  } finally {
    context.ancestors.pop()
  }
}

function encodeAttributes(
  attributes: LogAttributes,
  limits: OtlpLimits,
): { values: OTelJsonKeyValue[]; dropped: number } {
  const entries = Object.entries(attributes)
  const kept =
    entries.length > limits.attributeCountLimit
      ? entries.slice(0, limits.attributeCountLimit)
      : entries
  const context = createContext(limits, true)

  return {
    values: kept.map(([key, value]) => ({
      key,
      value: encodeValue(value, key, context),
    })),
    dropped: entries.length - kept.length,
  }
}

export function createOtlpLogRecord(
  severity: LogSeverity,
  body: LogAttributeValue,
  attributes: LogAttributes,
  extras: OtlpRecordExtras = {},
  limits: OtlpLimits = DEFAULT_LIMITS,
): OtlpLogRecord {
  const now = nowUnixNano().toString()
  let bodyValue = body
  let recordAttributes = attributes

  if (body instanceof Error) {
    const { type, message, stacktrace } = describeError(body)
    bodyValue = message || type
    recordAttributes = {
      'exception.type': type,
      'exception.message': message,
      ...(stacktrace === undefined
        ? {}
        : { 'exception.stacktrace': stacktrace }),
      ...attributes,
    }
  }

  const encoded = encodeAttributes(recordAttributes, limits)
  return {
    timeUnixNano: now,
    observedTimeUnixNano: now,
    severityNumber: severityNumbers[severity],
    severityText: severity.toUpperCase(),
    body: encodeValue(bodyValue, 'body', createContext(limits, false)),
    attributes: encoded.values,
    droppedAttributesCount: encoded.dropped || undefined,
    flags: extras.flags,
    traceId: extras.traceId,
    spanId: extras.spanId,
    eventName: extras.eventName,
  }
}

export function encodeOtlpLogRecord(
  record: OTelLogRecord,
  limits: OtlpLimits = DEFAULT_LIMITS,
): OtlpLogRecord {
  const encoded =
    record.attributes === undefined
      ? undefined
      : encodeAttributes(record.attributes, limits)
  const dropped = (record.droppedAttributesCount ?? 0) + (encoded?.dropped ?? 0)

  return {
    timeUnixNano: record.timeUnixNano?.toString(),
    observedTimeUnixNano: record.observedTimeUnixNano?.toString(),
    severityNumber: record.severityNumber,
    severityText: record.severityText,
    body:
      record.body === undefined
        ? undefined
        : encodeValue(record.body, 'body', createContext(limits, false)),
    attributes: encoded?.values,
    droppedAttributesCount:
      dropped === 0 ? record.droppedAttributesCount : dropped,
    flags: record.flags,
    traceId: record.traceId,
    spanId: record.spanId,
    eventName: record.eventName,
  }
}

function encodeScope(
  scope: SamLoggerScope | undefined,
): OTelJsonInstrumentationScope {
  const encoded: OTelJsonInstrumentationScope = {
    name: scope?.name ?? DEFAULT_SCOPE_NAME,
  }
  if (scope?.version !== undefined) encoded.version = scope.version
  if (scope?.attributes !== undefined) {
    encoded.attributes = encodeAttributes(
      scope.attributes,
      UNLIMITED_ATTRIBUTES,
    ).values
  }
  return encoded
}

export function createOtlpLogsRequest(
  resourceAttributes: LogAttributes,
  logRecords: readonly OtlpLogRecord[],
  options: OtlpRequestOptions = {},
): OTelJsonLogsData {
  const resourceLogs: OTelJsonResourceLogs = {
    resource: {
      attributes: encodeAttributes(resourceAttributes, UNLIMITED_ATTRIBUTES)
        .values,
    },
    scopeLogs: [
      {
        scope: encodeScope(options.scope),
        logRecords: [...logRecords],
        ...(options.scope?.schemaUrl === undefined
          ? {}
          : { schemaUrl: options.scope.schemaUrl }),
      },
    ],
    ...(options.resourceSchemaUrl === undefined
      ? {}
      : { schemaUrl: options.resourceSchemaUrl }),
  }

  return { resourceLogs: [resourceLogs] }
}
