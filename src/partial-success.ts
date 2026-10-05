export type PartialSuccess = {
  rejectedLogRecords: number
  errorMessage?: string
}

type JsonExportResponse = {
  partialSuccess?: {
    // OTLP/JSON encodes int64 as a string.
    rejectedLogRecords?: string | number
    errorMessage?: string
  }
}

function toPartialSuccess(
  body: JsonExportResponse,
): PartialSuccess | undefined {
  const partial = body.partialSuccess
  if (!partial) return undefined

  const rejected = Number(partial.rejectedLogRecords ?? 0)
  const rejectedLogRecords = Number.isFinite(rejected) ? rejected : 0
  const errorMessage = partial.errorMessage || undefined

  return rejectedLogRecords > 0 || errorMessage
    ? { rejectedLogRecords, errorMessage }
    : undefined
}

// A 200 response can still report rejected records; clients must not retry them.
export async function readPartialSuccess(
  response: Response,
): Promise<PartialSuccess | undefined> {
  if (response.status !== 200) return undefined
  if (!response.headers.get('Content-Type')?.includes('json')) return undefined

  try {
    return toPartialSuccess(
      JSON.parse(await response.text()) as JsonExportResponse,
    )
  } catch {
    return undefined
  }
}
