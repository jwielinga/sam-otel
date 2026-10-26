import { SERVICE_NAME } from './logger'

export type LokiEntry = {
  key: string
  timestampNs: string
  line: string
  severity: string
  attributes: Record<string, string>
}

type LokiResponse = {
  data: {
    result: {
      stream: Record<string, string>
      values: [
        string,
        string,
        { structuredMetadata?: Record<string, string> }?,
      ][]
    }[]
  }
}

const WINDOW_MINUTES = 15
const RESULT_LIMIT = 50

export async function fetchLokiEntries(
  signal: AbortSignal,
): Promise<LokiEntry[]> {
  const end = Date.now() * 1_000_000
  const start = end - WINDOW_MINUTES * 60 * 1_000_000_000
  const params = new URLSearchParams({
    query: `{service_name="${SERVICE_NAME}"}`,
    start: String(start),
    end: String(end),
    limit: String(RESULT_LIMIT),
    direction: 'backward',
  })
  const response = await fetch(`/loki/api/v1/query_range?${params}`, {
    signal,
    headers: { 'X-Loki-Response-Encoding-Flags': 'categorize-labels' },
  })
  if (!response.ok) throw new Error(`Loki returned HTTP ${response.status}`)

  const body = (await response.json()) as LokiResponse
  return body.data.result
    .flatMap(({ stream, values }) =>
      values.map(([timestampNs, line, metadata]) => {
        const attributes = metadata?.structuredMetadata ?? {}
        return {
          key: `${timestampNs}:${line}`,
          timestampNs,
          line,
          severity: (
            attributes.severity_text ??
            stream.detected_level ??
            'info'
          ).toLowerCase(),
          attributes,
        }
      }),
    )
    .sort((a, b) => (BigInt(b.timestampNs) > BigInt(a.timestampNs) ? 1 : -1))
}
