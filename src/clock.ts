const RESYNC_DRIFT_MS = 100

let anchorDateMs = 0
let anchorPerfMs = 0
let anchored = false

// Date.now() is millisecond-resolution; performance.now() adds sub-ms precision between resyncs.
export function nowUnixNano(): bigint {
  const dateMs = Date.now()
  if (
    typeof performance === 'undefined' ||
    typeof performance.now !== 'function'
  ) {
    return BigInt(dateMs) * 1_000_000n
  }

  const perfMs = performance.now()
  const predictedMs = anchorDateMs + (perfMs - anchorPerfMs)
  if (!anchored || Math.abs(dateMs - predictedMs) > RESYNC_DRIFT_MS) {
    anchored = true
    anchorDateMs = dateMs
    anchorPerfMs = perfMs
    return BigInt(dateMs) * 1_000_000n
  }

  return BigInt(Math.round(predictedMs * 1_000)) * 1_000n
}
