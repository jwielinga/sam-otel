---
sidebar_position: 13
title: Testing
---

# Testing

You never need a live collector to test code that uses Sam. Inject a `fetcher` that records requests.

## A recording fetcher

```ts
import { createSamLogger } from 'sam-otel'

const requests: Array<{ url: string; body: unknown }> = []

const logger = createSamLogger({
  endpoint: 'https://collector.test/v1/logs',
  serviceName: 'test-app',
  fetcher: async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) })
    return new Response(null, { status: 204 })
  },
  batch: { maxBatchSize: 1 }, // send every record right away
  detectResource: false, // keep the resource attributes predictable
})

await logger.info('hello', { userId: 'user-1' })
```

`requests[0].body` is the OTLP/JSON request: `resourceLogs[0].scopeLogs[0].logRecords[0]` holds your record. See the [OTLP payload reference](../reference/otlp-payload.md).

## Tips

- **Send immediately.** `batch: { maxBatchSize: 1 }` flushes each record as soon as it is logged. Or call `await logger.flush()` at the end of the test.
- **Skip retries.** Use `retry: false` when you test failure paths so a failing fake does not wait for backoff.
- **Simulate failures.** Return `new Response(null, { status: 503 })` or throw from the fetcher, then assert that the log promise rejects:

  ```ts
  const failing = createSamLogger({
    endpoint: 'https://collector.test/v1/logs',
    serviceName: 'test-app',
    retry: false,
    batch: { maxBatchSize: 1 },
    fetcher: async () => new Response(null, { status: 503 }),
  })

  await expect(failing.info('x')).rejects.toThrow('503')
  ```

- **Fake timers.** Batches sent by the timer, retry backoff, and request timeouts all use `setTimeout`, so they work with your test runner's fake timers.
- **Shut down.** Call `await logger.shutdown()` in teardown so the logger does not leave page listeners or pending timers behind.
- **No network in Node.** The `fetcher` option is also what lets Sam run in environments without a global `fetch`.

## Reading gzip bodies

With `compression: 'gzip'`, `init.body` is a `Uint8Array`. Decompress it before parsing:

```ts
async function gunzip(bytes: Uint8Array<ArrayBuffer>) {
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}
```
