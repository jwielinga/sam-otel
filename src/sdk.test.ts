import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSamLogger, SamLogger } from './sdk.js'
import { OTelSeverityNumber } from './otel.types.js'
import type { SamLoggerOptions } from './sdk.types.js'

const defaultFetcher: typeof fetch = async () =>
  new Response(null, { status: 204 })

function setup(options: Partial<SamLoggerOptions> = {}): SamLogger {
  return createSamLogger({
    endpoint: 'https://collector.example/v1/logs',
    serviceName: 'checkout',
    batch: { maxBatchSize: 1 },
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

  it('supports direct SamLogger construction', async () => {
    let exported = false
    const logger = new SamLogger({
      endpoint: '/v1/logs',
      serviceName: 'checkout',
      batch: { maxBatchSize: 1 },
      fetcher: async () => {
        exported = true
        return new Response(null, { status: 204 })
      },
    })

    await logger.info('direct construction')

    expect(exported).toBe(true)
  })

  describe('keepalive', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

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
