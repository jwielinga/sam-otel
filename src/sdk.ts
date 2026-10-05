import { LogBatcher } from './batcher.js'
import { OtlpHttpExporter, isFetchKeepaliveSupported } from './http-exporter.js'
import { LogLogger } from './logger.js'
import type { OtlpLogRecord } from './otlp.js'
import type { LogAttributes, SamLoggerOptions } from './sdk.types.js'

function createResourceAttributes(options: SamLoggerOptions): LogAttributes {
  return {
    ...options.resourceAttributes,
    'service.name': options.serviceName,
    ...(options.serviceVersion === undefined
      ? {}
      : { 'service.version': options.serviceVersion }),
  }
}

function createBatcher(options: SamLoggerOptions): LogBatcher<OtlpLogRecord> {
  const fetcher = options.fetcher ?? globalThis.fetch
  if (typeof fetcher !== 'function') {
    throw new TypeError(
      'fetch is not available in this environment; provide the fetcher option.',
    )
  }

  const exporter = new OtlpHttpExporter({
    endpoint: options.endpoint,
    resourceAttributes: createResourceAttributes(options),
    headers: options.headers,
    fetcher,
    keepalive: (options.keepalive ?? true) && isFetchKeepaliveSupported(),
  })

  return new LogBatcher({
    ...options.batch,
    sendBatch: (records) => exporter.export(records),
  })
}

export class SamLogger extends LogLogger {
  constructor(options: SamLoggerOptions) {
    if (!options.endpoint.trim()) {
      throw new TypeError('endpoint must be a non-empty string.')
    }
    if (!options.serviceName.trim()) {
      throw new TypeError('serviceName must be a non-empty string.')
    }

    super(createBatcher(options))
  }
}

export function createSamLogger(options: SamLoggerOptions): SamLogger {
  return new SamLogger(options)
}
