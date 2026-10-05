import { describe, expect, it, vi } from 'vitest'
import {
  OtlpExportError,
  OtlpHttpExporter,
  type OtlpHttpExporterOptions,
} from './http-exporter.js'
import type { OtlpLogRecord } from './otlp.js'

const record: OtlpLogRecord = {
  timeUnixNano: '1728000000000000000',
  severityNumber: 17,
  body: { stringValue: 'payment failed' },
}
const fastRetry = {
  maxAttempts: 3,
  initialDelayMs: 0,
  maxDelayMs: 10,
  backoffMultiplier: 2,
}

function createExporter(options: Partial<OtlpHttpExporterOptions> = {}) {
  return new OtlpHttpExporter({
    endpoint: 'https://collector.example/v1/logs',
    resourceAttributes: { 'service.name': 'checkout' },
    fetcher: async () => new Response(null, { status: 204 }),
    ...options,
  })
}

function sequenceFetcher(responses: Array<number | Error>) {
  const calls: RequestInit[] = []
  const fetcher: typeof fetch = async (_input, init) => {
    calls.push(init ?? {})
    const next = responses[calls.length - 1] ?? 204
    if (next instanceof Error) throw next
    return new Response(null, { status: next })
  }
  return { calls, fetcher }
}

describe('retry', () => {
  it.each([429, 502, 503, 504])(
    'retries HTTP %i until it succeeds',
    async (status) => {
      const { calls, fetcher } = sequenceFetcher([status, status, 204])
      const exporter = createExporter({ fetcher, retry: fastRetry })

      await expect(exporter.export([record])).resolves.toBeUndefined()
      expect(calls).toHaveLength(3)
    },
  )

  it('does not retry permanent failures', async () => {
    const { calls, fetcher } = sequenceFetcher([400])
    const exporter = createExporter({ fetcher, retry: fastRetry })

    const error = await exporter.export([record]).catch((e: unknown) => e)

    expect(calls).toHaveLength(1)
    expect(error).toBeInstanceOf(OtlpExportError)
    expect((error as OtlpExportError).retryable).toBe(false)
    expect((error as OtlpExportError).status).toBe(400)
  })

  it('gives up after maxAttempts and reports the last failure', async () => {
    const { calls, fetcher } = sequenceFetcher([503, 503, 503, 503])
    const exporter = createExporter({ fetcher, retry: fastRetry })

    await expect(exporter.export([record])).rejects.toThrow(
      'OTLP log request failed: 503',
    )
    expect(calls).toHaveLength(3)
  })

  it('retries network errors and keeps the original message', async () => {
    const { calls, fetcher } = sequenceFetcher([
      new TypeError('Failed to fetch'),
      204,
    ])
    const exporter = createExporter({ fetcher, retry: fastRetry })

    await expect(exporter.export([record])).resolves.toBeUndefined()
    expect(calls).toHaveLength(2)

    const failing = createExporter({
      fetcher: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    const error = await failing.export([record]).catch((e: unknown) => e)
    expect((error as Error).message).toBe('Failed to fetch')
    expect((error as Error).cause).toBeInstanceOf(TypeError)
    expect((error as OtlpExportError).retryable).toBe(true)
  })

  it('does not retry without a retry policy', async () => {
    const { calls, fetcher } = sequenceFetcher([503, 204])

    await expect(createExporter({ fetcher }).export([record])).rejects.toThrow()
    expect(calls).toHaveLength(1)
  })

  it('honors Retry-After within maxDelayMs and gives up beyond it', async () => {
    const calls: number[] = []
    const fetcher: typeof fetch = async () => {
      calls.push(calls.length)
      return calls.length === 1
        ? new Response(null, { status: 429, headers: { 'Retry-After': '0' } })
        : new Response(null, { status: 204 })
    }
    await createExporter({ fetcher, retry: fastRetry }).export([record])
    expect(calls).toHaveLength(2)

    const slow: typeof fetch = async () => {
      calls.push(calls.length)
      return new Response(null, {
        status: 503,
        headers: { 'Retry-After': '120' },
      })
    }
    calls.length = 0
    await expect(
      createExporter({ fetcher: slow, retry: fastRetry }).export([record]),
    ).rejects.toThrow('503')
    expect(calls).toHaveLength(1)
  })
})

describe('timeout', () => {
  function hangingFetcher(signals: AbortSignal[]): typeof fetch {
    return (_input, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal
        if (signal) {
          signals.push(signal)
          signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }
      })
  }

  it('aborts and rejects a request that exceeds timeoutMs', async () => {
    const signals: AbortSignal[] = []
    const exporter = createExporter({
      fetcher: hangingFetcher(signals),
      timeoutMs: 20,
    })

    const error = await exporter.export([record]).catch((e: unknown) => e)

    expect((error as Error).message).toBe(
      'OTLP log request timed out after 20ms',
    )
    expect((error as OtlpExportError).retryable).toBe(true)
    expect(signals[0]?.aborted).toBe(true)
  })

  it('retries a timed-out request', async () => {
    const signals: AbortSignal[] = []
    const exporter = createExporter({
      fetcher: hangingFetcher(signals),
      timeoutMs: 10,
      retry: { ...fastRetry, maxAttempts: 2 },
    })

    await expect(exporter.export([record])).rejects.toThrow('timed out')
    expect(signals).toHaveLength(2)
  })

  it('stops the timer after a successful request', async () => {
    vi.useFakeTimers()
    try {
      await createExporter({ timeoutMs: 5_000 }).export([record])
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('compression and scope', () => {
  it('gzips the body and sets Content-Encoding', async () => {
    const { calls, fetcher } = sequenceFetcher([204])

    await createExporter({ fetcher, compression: 'gzip' }).export([record])

    expect(calls[0]?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
    })
    const stream = new Blob([calls[0]?.body as Uint8Array<ArrayBuffer>])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'))
    expect(JSON.parse(await new Response(stream).text())).toMatchObject({
      resourceLogs: [{ scopeLogs: [{ logRecords: [record] }] }],
    })
  })

  it('sends uncompressed when CompressionStream is unavailable', async () => {
    vi.stubGlobal('CompressionStream', undefined)
    try {
      const { calls, fetcher } = sequenceFetcher([204])

      await createExporter({ fetcher, compression: 'gzip' }).export([record])

      expect(typeof calls[0]?.body).toBe('string')
      expect(calls[0]?.headers).not.toHaveProperty('Content-Encoding')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('applies scope and schema URL options', async () => {
    const { calls, fetcher } = sequenceFetcher([204])

    await createExporter({
      fetcher,
      scope: { name: 'web', version: '2', schemaUrl: 'https://scope' },
      resourceSchemaUrl: 'https://resource',
    }).export([record])

    expect(JSON.parse(String(calls[0]?.body))).toMatchObject({
      resourceLogs: [
        {
          schemaUrl: 'https://resource',
          scopeLogs: [
            {
              scope: { name: 'web', version: '2' },
              schemaUrl: 'https://scope',
            },
          ],
        },
      ],
    })
  })
})

describe('partial success', () => {
  function respondWith(body: BodyInit, contentType: string) {
    return async () =>
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': contentType },
      })
  }

  it('reports rejected records from a JSON response without failing', async () => {
    const onPartialSuccess = vi.fn()
    const exporter = createExporter({
      onPartialSuccess,
      fetcher: respondWith(
        JSON.stringify({
          partialSuccess: { rejectedLogRecords: '2', errorMessage: 'bad' },
        }),
        'application/json',
      ),
    })

    await expect(exporter.export([record])).resolves.toBeUndefined()
    expect(onPartialSuccess).toHaveBeenCalledWith({
      rejectedLogRecords: 2,
      errorMessage: 'bad',
    })
  })

  it('ignores empty, full-success, and malformed responses', async () => {
    const onPartialSuccess = vi.fn()

    for (const body of ['{}', '{"partialSuccess":{}}', 'not json']) {
      await createExporter({
        onPartialSuccess,
        fetcher: respondWith(body, 'application/json'),
      }).export([record])
    }

    expect(onPartialSuccess).not.toHaveBeenCalled()
  })
})

describe('unload export', () => {
  it('uses keepalive when the browser supports it', async () => {
    const { calls, fetcher } = sequenceFetcher([204])

    await createExporter({ fetcher, keepalive: true }).exportOnUnload([record])

    expect(calls[0]?.keepalive).toBe(true)
  })

  it('sends a plain request without keepalive support', async () => {
    const { calls, fetcher } = sequenceFetcher([204])

    await createExporter({ fetcher, keepalive: false }).exportOnUnload([record])

    expect(calls[0]).not.toHaveProperty('keepalive')
  })

  it('starts the request synchronously, without retry or compression', async () => {
    const { calls, fetcher } = sequenceFetcher([503, 204])
    const exporter = createExporter({
      fetcher,
      keepalive: true,
      compression: 'gzip',
      retry: fastRetry,
    })

    const pending = exporter.exportOnUnload([record])

    expect(calls).toHaveLength(1)
    await expect(pending).rejects.toThrow('503')
    expect(calls).toHaveLength(1)
    expect(typeof calls[0]?.body).toBe('string')
  })

  it('splits records so every request fits the keepalive limit', () => {
    const large = (id: string): OtlpLogRecord => ({
      ...record,
      body: { stringValue: id.repeat(30_000) },
    })
    const records = ['a', 'b', 'c', 'd'].map(large)
    const exporter = createExporter({ keepalive: true })

    const chunks = exporter.splitForUnload(records)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.flat()).toEqual(records)
    expect(
      createExporter({ keepalive: false }).splitForUnload(records),
    ).toEqual([records])
  })
})
