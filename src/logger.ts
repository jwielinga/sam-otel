import type { LogBatcher } from './batcher.js'
import {
  createOtlpLogRecord,
  encodeOtlpLogRecord,
  type OtlpLogRecord,
} from './otlp.js'
import type { OTelLogRecord } from './otel.types.js'
import type {
  LogAttributeValue,
  LogAttributes,
  LogSeverity,
} from './sdk.types.js'

export class LogLogger {
  private readonly batcher: LogBatcher<OtlpLogRecord>
  private isShutdown = false

  constructor(batcher: LogBatcher<OtlpLogRecord>) {
    this.batcher = batcher
  }

  log(
    severity: LogSeverity,
    body: LogAttributeValue,
    attributes: LogAttributes = {},
  ): Promise<void> {
    return this.enqueueRecord(() =>
      createOtlpLogRecord(severity, body, attributes),
    )
  }

  logRecord(record: OTelLogRecord): Promise<void> {
    return this.enqueueRecord(() => encodeOtlpLogRecord(record))
  }

  private enqueueRecord(createRecord: () => OtlpLogRecord): Promise<void> {
    if (this.isShutdown) {
      return Promise.reject(new Error('SamLogger has been shut down.'))
    }

    // The executor runs synchronously, so the record is queued before flush()/shutdown().
    return new Promise<void>((resolve) => {
      resolve(this.batcher.add(createRecord()))
    })
  }

  flush(): Promise<void> {
    return this.batcher.flush()
  }

  shutdown(): Promise<void> {
    this.isShutdown = true
    return this.batcher.shutdown()
  }

  trace(body: LogAttributeValue, attributes?: LogAttributes): Promise<void> {
    return this.log('trace', body, attributes)
  }

  debug(body: LogAttributeValue, attributes?: LogAttributes): Promise<void> {
    return this.log('debug', body, attributes)
  }

  info(body: LogAttributeValue, attributes?: LogAttributes): Promise<void> {
    return this.log('info', body, attributes)
  }

  warn(body: LogAttributeValue, attributes?: LogAttributes): Promise<void> {
    return this.log('warn', body, attributes)
  }

  error(body: LogAttributeValue, attributes?: LogAttributes): Promise<void> {
    return this.log('error', body, attributes)
  }
}
