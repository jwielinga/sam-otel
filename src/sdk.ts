import { LogBatcher } from './batcher.js'
import { isFetchKeepaliveSupported, OtlpHttpExporter } from './http-exporter.js'
import { SamLogger } from './logger.js'
import { resolveLimits, type OtlpLogRecord } from './otlp.js'
import { detectResourceAttributes } from './resource.js'
import { resolveRetryPolicy } from './retry.js'
import type {
  LogAttributes,
  SamDiagnosticEvent,
  SamLoggerOptions,
} from './sdk.types.js'

const DEFAULT_TIMEOUT_MS = 10_000

type Emit = (event: SamDiagnosticEvent) => void

function createResourceAttributes(options: SamLoggerOptions): LogAttributes {
  return {
    ...((options.detectResource ?? true) ? detectResourceAttributes() : {}),
    ...options.resourceAttributes,
    'service.name': options.serviceName,
    ...(options.serviceVersion === undefined
      ? {}
      : { 'service.version': options.serviceVersion }),
  }
}

function createEmitter(options: SamLoggerOptions): Emit {
  return (event) => {
    try {
      options.onDiagnostic?.(event)
    } catch {
      // A throwing diagnostics callback must not break logging.
    }
  }
}

function createExporter(
  options: SamLoggerOptions,
  emit: Emit,
): OtlpHttpExporter {
  const fetcher = options.fetcher ?? globalThis.fetch
  if (typeof fetcher !== 'function') {
    throw new TypeError(
      'fetch is not available in this environment; provide the fetcher option.',
    )
  }

  return new OtlpHttpExporter({
    endpoint: options.endpoint,
    resourceAttributes: createResourceAttributes(options),
    headers: options.headers,
    fetcher,
    keepalive: (options.keepalive ?? true) && isFetchKeepaliveSupported(),
    compression: options.compression,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retry: resolveRetryPolicy(options.retry),
    scope: options.scope,
    resourceSchemaUrl: options.resourceSchemaUrl,
    onPartialSuccess: ({ rejectedLogRecords, errorMessage }) =>
      emit({ type: 'partial-success', rejectedLogRecords, errorMessage }),
  })
}

function createBatcher(
  options: SamLoggerOptions,
  exporter: OtlpHttpExporter,
  emit: Emit,
): LogBatcher<OtlpLogRecord> {
  const reportFailure = (
    records: readonly OtlpLogRecord[],
    error: unknown,
  ): never => {
    emit({ type: 'export-failed', error, recordCount: records.length })
    throw error
  }

  return new LogBatcher<OtlpLogRecord>({
    ...options.batch,
    sendBatch: (records) =>
      exporter
        .export(records)
        .catch((error: unknown) => reportFailure(records, error)),
    // Starts every request synchronously: the page may be gone after the handler returns.
    sendBatchOnUnload: async (records) => {
      const results = await Promise.allSettled(
        exporter
          .splitForUnload(records)
          .map((chunk) =>
            exporter
              .exportOnUnload(chunk)
              .catch((error: unknown) => reportFailure(chunk, error)),
          ),
      )

      const failure = results.find((result) => result.status === 'rejected')
      if (failure) throw failure.reason as unknown
    },
    onDropped: (totalDropped) =>
      emit({ type: 'records-dropped', reason: 'queue-full', totalDropped }),
  })
}

// Returns a function that removes the listeners again.
function flushOnPageUnload(batcher: LogBatcher<OtlpLogRecord>): () => void {
  const flushOnPageHide = (): void => {
    void batcher.flushOnUnload().catch(() => undefined)
  }
  const flushWhenHidden = (): void => {
    if (document.visibilityState === 'hidden') flushOnPageHide()
  }

  globalThis.addEventListener?.('pagehide', flushOnPageHide)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', flushWhenHidden)
  }

  return () => {
    globalThis.removeEventListener?.('pagehide', flushOnPageHide)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', flushWhenHidden)
    }
  }
}

export function createSamLogger(options: SamLoggerOptions): SamLogger {
  if (!options.endpoint.trim()) {
    throw new TypeError('endpoint must be a non-empty string.')
  }
  if (!options.serviceName.trim()) {
    throw new TypeError('serviceName must be a non-empty string.')
  }

  const emit = createEmitter(options)
  const exporter = createExporter(options, emit)
  const batcher = createBatcher(options, exporter, emit)

  return new SamLogger(batcher, {
    limits: resolveLimits(options.limits),
    traceContext: options.traceContext,
    onShutdown: flushOnPageUnload(batcher),
  })
}
