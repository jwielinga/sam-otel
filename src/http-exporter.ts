import { createOtlpLogsRequest, type OtlpLogRecord } from './otlp.js'
import type { LogAttributes } from './sdk.types.js'

export interface OtlpHttpExporterOptions {
  endpoint: string
  resourceAttributes: LogAttributes
  headers?: Readonly<Record<string, string>>
  fetcher: typeof fetch
}

export class OtlpHttpExporter {
  private readonly endpoint: string
  private readonly resourceAttributes: LogAttributes
  private readonly headers: Readonly<Record<string, string>>
  private readonly fetcher: typeof fetch

  constructor(options: OtlpHttpExporterOptions) {
    this.endpoint = options.endpoint
    this.resourceAttributes = options.resourceAttributes
    this.headers = { ...options.headers }
    this.fetcher = options.fetcher
  }

  async export(records: readonly OtlpLogRecord[]): Promise<void> {
    const request = createOtlpLogsRequest(this.resourceAttributes, records)
    const response = await this.fetcher(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : ''
      throw new Error(
        `OTLP log request failed: ${response.status}${statusText}`,
      )
    }
  }
}
