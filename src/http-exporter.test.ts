import { afterEach, describe, expect, it, vi } from 'vitest'
import { isFetchKeepaliveSupported, OtlpHttpExporter } from './http-exporter.js'
import type { OtlpLogRecord } from './otlp.js'

const resourceAttributes = { 'service.name': 'checkout' }
const record: OtlpLogRecord = {
  timeUnixNano: '1728000000000000000',
  severityNumber: 17,
  severityText: 'ERROR',
  body: { stringValue: 'payment failed' },
}

describe('OtlpHttpExporter', () => {
  it('posts OTLP JSON with configured headers and resource attributes', async () => {
    let requestUrl: string | URL | Request | undefined
    let request: RequestInit | undefined
    const exporter = new OtlpHttpExporter({
      endpoint: 'https://collector.example/v1/logs',
      resourceAttributes,
      headers: { Authorization: 'Bearer test-token' },
      fetcher: async (input, init) => {
        requestUrl = input
        request = init
        return new Response(null, { status: 204 })
      },
    })

    await exporter.export([record])

    expect(requestUrl).toBe('https://collector.example/v1/logs')
    expect(request?.method).toBe('POST')
    expect(request?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    })
    expect(JSON.parse(String(request?.body))).toMatchObject({
      resourceLogs: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'checkout' } },
            ],
          },
          scopeLogs: [{ logRecords: [record] }],
        },
      ],
    })
  })

  it('rejects non-successful collector responses', async () => {
    const exporter = new OtlpHttpExporter({
      endpoint: '/v1/logs',
      resourceAttributes,
      fetcher: async () =>
        new Response(null, { status: 503, statusText: 'Unavailable' }),
    })

    await expect(exporter.export([record])).rejects.toThrow(
      'OTLP log request failed: 503 Unavailable',
    )
  })

  it('converts synchronous fetcher errors to promise rejections', async () => {
    const exporter = new OtlpHttpExporter({
      endpoint: '/v1/logs',
      resourceAttributes,
      fetcher: () => {
        throw new Error('fetcher failed synchronously')
      },
    })

    await expect(exporter.export([record])).rejects.toThrow(
      'fetcher failed synchronously',
    )
  })

  describe('keepalive', () => {
    function capture(keepalive: boolean | undefined) {
      const requests: RequestInit[] = []
      const exporter = new OtlpHttpExporter({
        endpoint: '/v1/logs',
        resourceAttributes,
        keepalive,
        fetcher: async (_input, init) => {
          requests.push(init ?? {})
          return new Response(null, { status: 204 })
        },
      })
      return { exporter, requests }
    }

    it('sets fetch keepalive when enabled', async () => {
      const { exporter, requests } = capture(true)

      await exporter.export([record])

      expect(requests[0]?.keepalive).toBe(true)
    })

    it('omits keepalive when disabled or unset', async () => {
      const disabled = capture(false)
      const unset = capture(undefined)

      await disabled.exporter.export([record])
      await unset.exporter.export([record])

      expect(disabled.requests[0]).not.toHaveProperty('keepalive')
      expect(unset.requests[0]).not.toHaveProperty('keepalive')
    })

    it('never sends a Connection header', async () => {
      const { exporter, requests } = capture(true)

      await exporter.export([record])

      expect(requests[0]?.headers).not.toHaveProperty('Connection')
    })

    it('omits keepalive when the body exceeds the browser limit', async () => {
      const { exporter, requests } = capture(true)
      const large: OtlpLogRecord = {
        ...record,
        body: { stringValue: 'x'.repeat(70 * 1024) },
      }

      await exporter.export([large])

      expect(requests[0]).not.toHaveProperty('keepalive')
    })
  })

  describe('isFetchKeepaliveSupported', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('is false when Request lacks keepalive', () => {
      vi.stubGlobal('Request', class {})

      expect(isFetchKeepaliveSupported()).toBe(false)
    })

    it('is false when Request is undefined', () => {
      vi.stubGlobal('Request', undefined)

      expect(isFetchKeepaliveSupported()).toBe(false)
    })

    it('is true when Request exposes keepalive', () => {
      vi.stubGlobal(
        'Request',
        class {
          get keepalive() {
            return false
          }
        },
      )

      expect(isFetchKeepaliveSupported()).toBe(true)
    })
  })
})
