import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSamLogger } from './sdk.js'
import type { SamLogger } from './logger.js'
import { OTelSeverityNumber } from './otel.types.js'
import type { SamLoggerOptions } from './sdk.types.js'

const defaultFetcher: typeof fetch = async () =>
  new Response(null, { status: 204 })

afterEach(() => {
  vi.unstubAllGlobals()
})

function setup(options: Partial<SamLoggerOptions> = {}): SamLogger {
  return createSamLogger({
    endpoint: 'https://collector.example/v1/logs',
    serviceName: 'checkout',
    batch: { maxBatchSize: 1 },
    detectResource: false,
    ...options,
    fetcher: options.fetcher ?? defaultFetcher,
  })
}

describe('SDK factory', () => {
  it('creates logger that exports OTel fields and merged resource attributes', async () => {
    let requestBody = ''
    const logger = setup({
      serviceVersion: '1.2.3',
      resourceAttributes: {
        'deployment.environment.name': 'test',
        'service.name': 'overridden',
      },
      fetcher: async (_input, init) => {
        requestBody = String(init?.body)
        return new Response(null, { status: 204 })
      },
    })

    await logger.logRecord({
      severityNumber: OTelSeverityNumber.INFO,
      severityText: 'INFO',
      body: { message: 'checkout complete', orderId: 'order-42' },
      traceId: '5B8EFFF798038103D269B633813FC60C',
      spanId: 'EEE19B7EC3C1B174',
      eventName: 'checkout.completed',
    })

    expect(JSON.parse(requestBody)).toMatchObject({
      resourceLogs: [
        {
          resource: {
            attributes: [
              {
                key: 'deployment.environment.name',
                value: { stringValue: 'test' },
              },
              { key: 'service.name', value: { stringValue: 'checkout' } },
              { key: 'service.version', value: { stringValue: '1.2.3' } },
            ],
          },
          scopeLogs: [
            {
              logRecords: [
                {
                  severityNumber: OTelSeverityNumber.INFO,
                  severityText: 'INFO',
                  body: {
                    kvlistValue: {
                      values: [
                        {
                          key: 'message',
                          value: { stringValue: 'checkout complete' },
                        },
                        { key: 'orderId', value: { stringValue: 'order-42' } },
                      ],
                    },
                  },
                  traceId: '5B8EFFF798038103D269B633813FC60C',
                  spanId: 'EEE19B7EC3C1B174',
                  eventName: 'checkout.completed',
                },
              ],
            },
          ],
        },
      ],
    })
  })

  it('batches application logs using configured thresholds', async () => {
    const requests: unknown[] = []
    const logger = setup({
      batch: { maxBatchSize: 2, scheduledDelayMs: 60_000 },
      fetcher: async (_input, init) => {
        requests.push(JSON.parse(String(init?.body)))
        return new Response(null, { status: 204 })
      },
    })
    const first = logger.info('checkout started')
    const second = logger.error('payment failed')

    await Promise.all([first, second])

    expect(requests).toHaveLength(1)
    expect(
      (
        requests[0] as {
          resourceLogs: Array<{ scopeLogs: Array<{ logRecords: unknown[] }> }>
        }
      ).resourceLogs[0]?.scopeLogs[0]?.logRecords,
    ).toHaveLength(2)
  })

  it('rejects instead of throwing for values that cannot be encoded', async () => {
    const logger = setup()

    await expect(logger.info('bad', { ratio: Number.NaN })).rejects.toThrow(
      'Log attribute "ratio" must be a finite number.',
    )
    await expect(logger.logRecord({ body: 2n ** 63n })).rejects.toThrow(
      'Log attribute "body" must fit in a signed int64.',
    )
  })

  it('keeps working after an encoding failure', async () => {
    const logger = setup()

    await expect(logger.info('bad', { ratio: Infinity })).rejects.toThrow()
    await expect(logger.info('good')).resolves.toBeUndefined()
  })

  it('queues a log synchronously so an immediate flush sends it', async () => {
    const requests: unknown[] = []
    const logger = setup({
      batch: { maxBatchSize: 10, scheduledDelayMs: 60_000 },
      fetcher: async (_input, init) => {
        requests.push(JSON.parse(String(init?.body)))
        return new Response(null, { status: 204 })
      },
    })

    const pending = logger.info('queued')
    await logger.flush()
    await pending

    expect(requests).toHaveLength(1)
  })

  it('sends a log made just before shutdown', async () => {
    const requests: unknown[] = []
    const logger = setup({
      batch: { maxBatchSize: 10, scheduledDelayMs: 60_000 },
      fetcher: async (_input, init) => {
        requests.push(JSON.parse(String(init?.body)))
        return new Response(null, { status: 204 })
      },
    })

    const pending = logger.info('last words')
    await logger.shutdown()
    await expect(pending).resolves.toBeUndefined()

    expect(requests).toHaveLength(1)
  })

  it('fails fast when no fetch implementation is available', () => {
    vi.stubGlobal('fetch', undefined)

    expect(() =>
      createSamLogger({ endpoint: '/v1/logs', serviceName: 'checkout' }),
    ).toThrow('fetch is not available in this environment')
  })

  describe('keepalive', () => {
    async function sendOne(
      options: Partial<SamLoggerOptions>,
    ): Promise<RequestInit | undefined> {
      let init: RequestInit | undefined
      const logger = setup({
        ...options,
        fetcher: async (_input, requestInit) => {
          init = requestInit
          return new Response(null, { status: 204 })
        },
      })

      await logger.info('unload test')
      return init
    }

    it('is enabled by default when the browser supports it', async () => {
      vi.stubGlobal(
        'Request',
        class {
          get keepalive() {
            return false
          }
        },
      )

      expect((await sendOne({}))?.keepalive).toBe(true)
    })

    it('can be disabled', async () => {
      vi.stubGlobal(
        'Request',
        class {
          get keepalive() {
            return false
          }
        },
      )

      expect(await sendOne({ keepalive: false })).not.toHaveProperty(
        'keepalive',
      )
    })

    it('is skipped in browsers without keepalive support', async () => {
      vi.stubGlobal('Request', class {})

      expect(await sendOne({})).not.toHaveProperty('keepalive')
    })
  })
})
