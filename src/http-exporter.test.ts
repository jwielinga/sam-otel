import { describe, expect, it } from 'vitest'
import { OtlpHttpExporter } from './http-exporter.js'
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
})
