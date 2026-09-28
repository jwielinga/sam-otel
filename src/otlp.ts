import {
  OTelSeverityNumber,
  type OTelAnyValue,
  type OTelAttributes,
  type OTelJsonAnyValue,
  type OTelJsonKeyValue,
  type OTelJsonLogRecord,
  type OTelJsonLogsData,
  type OTelLogRecord,
} from './otel.types.js'
import type { LogAttributes, LogSeverity } from './sdk.types.js'

export type OtlpLogRecord = OTelJsonLogRecord

const severityNumbers: Record<LogSeverity, OTelSeverityNumber> = {
  trace: OTelSeverityNumber.TRACE,
  debug: OTelSeverityNumber.DEBUG,
  info: OTelSeverityNumber.INFO,
  warn: OTelSeverityNumber.WARN,
  error: OTelSeverityNumber.ERROR,
}

const MIN_INT64 = -(1n << 63n)
const MAX_INT64 = (1n << 63n) - 1n

function encodeBytes(value: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < value.length; offset += chunkSize) {
    binary += String.fromCharCode(...value.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function encodeValue(value: OTelAnyValue, key: string): OTelJsonAnyValue {
  if (typeof value === 'string') return { stringValue: value }
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
  if (Array.isArray(value)) {
    return {
      arrayValue: { values: value.map((item) => encodeValue(item, key)) },
    }
  }

  return {
    kvlistValue: {
      values: Object.entries(value).map(([nestedKey, nestedValue]) => ({
        key: nestedKey,
        value: encodeValue(nestedValue, `${key}.${nestedKey}`),
      })),
    },
  }
}

function encodeAttributes(
  attributes: Readonly<OTelAttributes>,
): OTelJsonKeyValue[] {
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value: encodeValue(value, key),
  }))
}

export function createOtlpLogRecord(
  severity: LogSeverity,
  body: OTelAnyValue,
  attributes: LogAttributes,
): OtlpLogRecord {
  return {
    timeUnixNano: (BigInt(Date.now()) * 1_000_000n).toString(),
    severityNumber: severityNumbers[severity],
    severityText: severity.toUpperCase(),
    body: encodeValue(body, 'body'),
    attributes: encodeAttributes(attributes),
  }
}

export function encodeOtlpLogRecord(record: OTelLogRecord): OtlpLogRecord {
  return {
    timeUnixNano: record.timeUnixNano?.toString(),
    observedTimeUnixNano: record.observedTimeUnixNano?.toString(),
    severityNumber: record.severityNumber,
    severityText: record.severityText,
    body:
      record.body === undefined ? undefined : encodeValue(record.body, 'body'),
    attributes:
      record.attributes === undefined
        ? undefined
        : encodeAttributes(record.attributes),
    droppedAttributesCount: record.droppedAttributesCount,
    flags: record.flags,
    traceId: record.traceId,
    spanId: record.spanId,
    eventName: record.eventName,
  }
}

export function createOtlpLogsRequest(
  resourceAttributes: LogAttributes,
  logRecords: readonly OtlpLogRecord[],
): OTelJsonLogsData {
  return {
    resourceLogs: [
      {
        resource: { attributes: encodeAttributes(resourceAttributes) },
        scopeLogs: [
          {
            scope: { name: 'sam' },
            logRecords: [...logRecords],
          },
        ],
      },
    ],
  }
}
