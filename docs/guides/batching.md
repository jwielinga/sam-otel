---
sidebar_position: 5
title: Batching and flushing
---

# Batching and flushing

Som never sends one request per log. Records go into a queue and leave in batches, which keeps the number of requests low.

## When a batch is sent

A batch is exported when **either**:

- the queue holds `maxBatchSize` records (default `20`), or
- `scheduledDelayMs` (default `5000`) have passed since the first record entered an empty queue.

The timer is not reset by later records. After a batch is sent and more records remain, the timer starts again.

```ts
const logger = createSomLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  batch: {
    maxBatchSize: 50,
    maxQueueSize: 1_000,
    scheduledDelayMs: 2_000,
  },
})
```

| Option             | Default        | Meaning                                                                   |
| ------------------ | -------------- | ------------------------------------------------------------------------- |
| `maxBatchSize`     | `20`           | Maximum records per request. Reaching it triggers a send.                 |
| `maxQueueSize`     | `1000`         | Maximum records waiting to be sent, not counting the batch in flight.     |
| `scheduledDelayMs` | `5000`         | Longest a record waits before a timer-triggered send (`0`–`2147483647`).  |
| `overflowStrategy` | `'reject-new'` | What to do when the queue is full. See [Queue overflow](#queue-overflow). |

Batches are sent one at a time, in order. Records queued while a request is in flight go out in the next batch, and never exceed `maxBatchSize` per request.

## Promises

Each log call's promise settles with its batch: it resolves when the batch is exported and rejects when the export fails. All records in a failed batch reject with the same error.

## Flushing

`flush()` sends everything queued right now and resolves when it is done:

```ts
await logger.flush()
```

`shutdown()` flushes too, and also stops the logger from accepting new records. It removes the page listeners Som installed (see [Page unload](./page-unload.md)).

```ts
await logger.shutdown()
```

Both reject if an export fails. If several batches fail, the error is an `AggregateError` with the message `Multiple OTLP log batches failed.` and the individual errors in `errors`.

## Queue overflow

The queue is bounded by `maxQueueSize`. A queue fills up when the collector is slow or unreachable while your app keeps logging. Choose how Som reacts:

- **`'reject-new'`** (default): the new log call rejects with `SomLogger batch queue is full.` and everything already queued is kept. Older logs win.
- **`'drop-oldest'`**: the oldest queued record is evicted to make room and its promise rejects with `SomLogger batch queue is full; oldest record dropped.` Newer logs win.

```ts
const logger = createSomLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  batch: { maxQueueSize: 500, overflowStrategy: 'drop-oldest' },
})
```

With either strategy, `logger.droppedRecordCount` returns how many records were dropped so far, and `onDiagnostic` receives a `records-dropped` event each time. See [Diagnostics](./diagnostics.md).

## Memory only

The queue lives in memory. Records that are still queued when the page closes without a flush are lost; Som flushes on page hide to avoid this in normal navigation.
