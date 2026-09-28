export type OTelTraceId = string
export type OTelSpanId = string
export type OTelTraceFlags = number
export type OTelTimestamp = bigint

export type OTelAnyValue =
  | string
  | boolean
  | number
  | bigint
  | Uint8Array
  | OTelAnyValue[]
  | { [key: string]: OTelAnyValue }

export type OTelAttributes = Record<string, OTelAnyValue>

export interface OTelEntityRef {
  key: string
  id: OTelAnyValue
}

export interface OTelResource {
  attributes?: OTelAttributes
  droppedAttributesCount?: number
  entityRefs?: OTelEntityRef[]
}

export interface OTelInstrumentationScope {
  name?: string
  version?: string
  attributes?: OTelAttributes
  droppedAttributesCount?: number
}

export enum OTelSeverityNumber {
  UNSPECIFIED = 0,
  TRACE = 1,
  TRACE2 = 2,
  TRACE3 = 3,
  TRACE4 = 4,
  DEBUG = 5,
  DEBUG2 = 6,
  DEBUG3 = 7,
  DEBUG4 = 8,
  INFO = 9,
  INFO2 = 10,
  INFO3 = 11,
  INFO4 = 12,
  WARN = 13,
  WARN2 = 14,
  WARN3 = 15,
  WARN4 = 16,
  ERROR = 17,
  ERROR2 = 18,
  ERROR3 = 19,
  ERROR4 = 20,
  FATAL = 21,
  FATAL2 = 22,
  FATAL3 = 23,
  FATAL4 = 24,
}

export const OTelLogRecordFlags = {
  TRACE_FLAGS_MASK: 0x000000ff,
} as const

export type OTelLogRecordFlagsValue = number

export interface OTelLogRecord {
  timeUnixNano?: OTelTimestamp
  observedTimeUnixNano?: OTelTimestamp
  severityNumber?: OTelSeverityNumber
  severityText?: string
  body?: OTelAnyValue
  attributes?: OTelAttributes
  droppedAttributesCount?: number
  flags?: OTelLogRecordFlagsValue
  traceId?: OTelTraceId
  spanId?: OTelSpanId
  eventName?: string
}

export interface OTelScopeLogs {
  scope?: OTelInstrumentationScope
  schemaUrl?: string
  logRecords?: OTelLogRecord[]
}

export interface OTelResourceLogs {
  resource?: OTelResource
  scopeLogs?: OTelScopeLogs[]
  schemaUrl?: string
}

export interface OTelLogsData {
  resourceLogs?: OTelResourceLogs[]
}

export type OTelLogs = OTelLogRecord[]
export type OTelExportLogsServiceRequest = OTelLogsData

export type OTelJsonUint64 = string
export type OTelJsonTraceId = string
export type OTelJsonSpanId = string

export interface OTelJsonAnyValue {
  stringValue?: string
  boolValue?: boolean
  intValue?: OTelJsonUint64
  doubleValue?: number
  bytesValue?: string
  arrayValue?: OTelJsonArrayValue
  kvlistValue?: OTelJsonKeyValueList
}

export interface OTelJsonArrayValue {
  values?: OTelJsonAnyValue[]
}

export interface OTelJsonKeyValueList {
  values?: OTelJsonKeyValue[]
}

export interface OTelJsonKeyValue {
  key: string
  value?: OTelJsonAnyValue
}

export interface OTelJsonResource {
  attributes?: OTelJsonKeyValue[]
  droppedAttributesCount?: number
  entityRefs?: OTelJsonEntityRef[]
}

export interface OTelJsonEntityRef {
  key: string
  id?: OTelJsonAnyValue
}

export interface OTelJsonInstrumentationScope {
  name?: string
  version?: string
  attributes?: OTelJsonKeyValue[]
  droppedAttributesCount?: number
}

export interface OTelJsonScopeLogs {
  scope?: OTelJsonInstrumentationScope
  logRecords?: OTelJsonLogRecord[]
  schemaUrl?: string
}

export interface OTelJsonResourceLogs {
  resource?: OTelJsonResource
  scopeLogs?: OTelJsonScopeLogs[]
  schemaUrl?: string
}

export interface OTelJsonLogRecord {
  timeUnixNano?: OTelJsonUint64
  observedTimeUnixNano?: OTelJsonUint64
  severityNumber?: OTelSeverityNumber
  severityText?: string
  body?: OTelJsonAnyValue
  attributes?: OTelJsonKeyValue[]
  droppedAttributesCount?: number
  flags?: number
  traceId?: OTelJsonTraceId
  spanId?: OTelJsonSpanId
  eventName?: string
}

export interface OTelJsonLogsData {
  resourceLogs?: OTelJsonResourceLogs[]
}

export type OTelJsonExportLogsServiceRequest = OTelJsonLogsData

export interface OTelApplicationLog extends OTelLogRecord {
  body?: string | Record<string, OTelAnyValue>
}

export interface OTelEvent extends OTelLogRecord {
  eventName: string
}

export interface OTelSimpleLog extends OTelLogRecord {
  body?: string
}
