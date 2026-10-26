import type { SomLoggerRetryOptions } from './sdk.types.js'

export type RetryPolicy = Required<SomLoggerRetryOptions>

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
}

// OTLP/HTTP: only these statuses are retryable.
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([
  429, 502, 503, 504,
])

export function resolveRetryPolicy(
  options: SomLoggerRetryOptions | false | undefined,
): RetryPolicy | undefined {
  if (options === false) return undefined

  return {
    maxAttempts: options?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
    initialDelayMs:
      options?.initialDelayMs ?? DEFAULT_RETRY_POLICY.initialDelayMs,
    maxDelayMs: options?.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs,
    backoffMultiplier:
      options?.backoffMultiplier ?? DEFAULT_RETRY_POLICY.backoffMultiplier,
  }
}

// Exponential backoff with equal jitter; `retryNumber` starts at 1.
export function computeBackoffMs(
  policy: RetryPolicy,
  retryNumber: number,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(
    policy.maxDelayMs,
    policy.initialDelayMs * policy.backoffMultiplier ** (retryNumber - 1),
  )
  return Math.round(ceiling / 2 + (random() * ceiling) / 2)
}

// Accepts delay-seconds or an HTTP-date.
export function parseRetryAfter(
  header: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (header === null || header === undefined) return undefined

  const trimmed = header.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1_000

  const date = Date.parse(trimmed)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
