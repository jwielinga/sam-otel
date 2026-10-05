---
sidebar_position: 8
title: Diagnostics
---

# Diagnostics

Most failures happen in the background, after your log call has already returned: a batch fails to export, the queue overflows, the collector rejects part of a request. Log promises report some of these, but a fire-and-forget call has nobody listening. `onDiagnostic` gives you one place to observe them all.

```ts
const logger = createSamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  onDiagnostic(event) {
    switch (event.type) {
      case 'export-failed':
        console.warn(`Lost ${event.recordCount} log records`, event.error)
        break
      case 'partial-success':
        console.warn(
          `${event.rejectedLogRecords} records rejected`,
          event.errorMessage,
        )
        break
      case 'records-dropped':
        console.warn(`Queue full, ${event.totalDropped} records dropped so far`)
        break
    }
  },
})
```

`SamDiagnosticEvent` is a discriminated union, so TypeScript narrows each event by its `type`.

## Events

| `type`            | When                                                        | Fields                                    |
| ----------------- | ----------------------------------------------------------- | ----------------------------------------- |
| `export-failed`   | A batch could not be exported, after all retries.           | `error`, `recordCount`                    |
| `partial-success` | The collector accepted a request but rejected some records. | `rejectedLogRecords`, `errorMessage?`     |
| `records-dropped` | The queue was full and a record was dropped.                | `reason` (`'queue-full'`), `totalDropped` |

`export-failed` fires for each failed batch, including page-unload sends. `records-dropped` fires once per dropped record, with a running total.

## Safe by design

- Sam calls your callback synchronously and ignores anything it throws, so a bug in diagnostics code never breaks logging.
- Keep the callback fast and avoid logging from it with the same logger, which can create a loop when exports keep failing.

## Other signals

- `logger.droppedRecordCount` returns the number of dropped records at any time.
- Log promises reject for failed exports. See [Writing logs](./writing-logs.md#promises-and-failures).

## Development logging

Print diagnostics only while developing (this example uses Vite's `import.meta.env.DEV`):

```ts
onDiagnostic: (event) => {
  if (import.meta.env.DEV) console.debug('[sam]', event)
}
```
