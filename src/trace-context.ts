import type { TraceContextProvider } from './sdk.types.js'

export type OTelApiLike<TContext> = {
  trace: {
    getSpanContext(
      context: TContext,
    ): { traceId: string; spanId: string; traceFlags: number } | undefined
  }
  context: { active(): TContext }
}

// Usage: traceContextFromApi({ trace, context }) with `@opentelemetry/api`.
export function traceContextFromApi<TContext>(
  api: OTelApiLike<TContext>,
): TraceContextProvider {
  return () => api.trace.getSpanContext(api.context.active())
}
