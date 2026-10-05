import { createOtlpLogsRequest, type OtlpLogRecord } from './otlp.js'
import type { LogAttributes } from './sdk.types.js'

// Browsers cap in-flight keepalive bodies at 64 KiB; stay below it.
const KEEPALIVE_MAX_BODY_BYTES = 63 * 1024

export interface OtlpHttpExporterOptions {
  endpoint: string
  resourceAttributes: LogAttributes
  headers?: Readonly<Record<string, string>>
  fetcher: typeof fetch
  keepalive?: boolean
}

// Older browsers lack fetch `keepalive` and silently ignore the flag.
export function isFetchKeepaliveSupported(): boolean {
  return typeof Request !== 'undefined' && 'keepalive' in Request.prototype
}

function fitsKeepaliveLimit(body: string): boolean {
  if (body.length > KEEPALIVE_MAX_BODY_BYTES) return false
  return (
    typeof TextEncoder !== 'undefined' &&
    new TextEncoder().encode(body).length <= KEEPALIVE_MAX_BODY_BYTES
  )
}

export class OtlpHttpExporter {
  private readonly endpoint: string
  private readonly resourceAttributes: LogAttributes
  private readonly headers: Readonly<Record<string, string>>
  private readonly fetcher: typeof fetch
  private readonly keepalive: boolean

  constructor(options: OtlpHttpExporterOptions) {
    this.endpoint = options.endpoint
    this.resourceAttributes = options.resourceAttributes
    this.headers = { ...options.headers }
    this.fetcher = options.fetcher
    this.keepalive = options.keepalive ?? false
  }

  async export(records: readonly OtlpLogRecord[]): Promise<void> {
    const request = createOtlpLogsRequest(this.resourceAttributes, records)
    const body = JSON.stringify(request)
    // Detach from `this`: browser fetch throws "Illegal invocation" as a method.
    const fetcher = this.fetcher
    const response = await fetcher(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body,
      ...(this.keepalive && fitsKeepaliveLimit(body)
        ? { keepalive: true }
        : {}),
    })

    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : ''
      throw new Error(
        `OTLP log request failed: ${response.status}${statusText}`,
      )
    }
  }
}
