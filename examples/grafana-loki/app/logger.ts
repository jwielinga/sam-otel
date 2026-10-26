import { createSamLogger } from 'sam-otel'

export const SERVICE_NAME = 'sam-demo'

export const logger = createSamLogger({
  endpoint:
    import.meta.env.VITE_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/logs',
  serviceName: SERVICE_NAME,
  serviceVersion: '0.1.0',
  resourceAttributes: {
    'deployment.environment.name': import.meta.env.MODE,
  },
  // Demo values for instant feedback; the defaults (20 records, 5s, 3 attempts) suit production.
  batch: { maxBatchSize: 2, scheduledDelayMs: 250 },
  retry: false,
  onDiagnostic: (event) => {
    if (import.meta.env.DEV) console.debug('[sam]', event)
  },
})
