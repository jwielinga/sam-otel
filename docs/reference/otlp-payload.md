---
sidebar_position: 4
title: OTLP payload
---

# OTLP payload

This page shows exactly what Som sends, which helps when you test, debug a collector, or write a custom receiver.

## The request

- Method: `POST` to your `endpoint`.
- Headers: `Content-Type: application/json`, `Content-Encoding: gzip` when compressing, plus your `headers`.
- Body: an OTLP/JSON `ExportLogsServiceRequest` with one `resourceLogs` entry and one `scopeLogs` entry. Every record of the batch is in `logRecords`.

## Example

For this code:

```ts
const logger = createSomLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  serviceVersion: '2.1.0',
  detectResource: false,
})

await logger.info('Checkout completed', { orderId: 'order-42', total: 12.5 })
```

Som sends:

```json
{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "storefront" } },
          { "key": "service.version", "value": { "stringValue": "2.1.0" } }
        ]
      },
      "scopeLogs": [
        {
          "scope": { "name": "som" },
          "logRecords": [
            {
              "timeUnixNano": "1791201600000000000",
              "observedTimeUnixNano": "1791201600000000000",
              "severityNumber": 9,
              "severityText": "INFO",
              "body": { "stringValue": "Checkout completed" },
              "attributes": [
                { "key": "orderId", "value": { "stringValue": "order-42" } },
                { "key": "total", "value": { "doubleValue": 12.5 } }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Encoding rules

| Item               | Encoding                                                                               |
| ------------------ | -------------------------------------------------------------------------------------- |
| Timestamps         | Unix time in nanoseconds as a **decimal string**, for example `"1791201600000000000"`. |
| 64-bit integers    | Decimal strings: `intValue: "9007199254740993"`.                                       |
| Numbers            | `doubleValue`.                                                                         |
| Bytes              | `bytesValue`, base64.                                                                  |
| Trace and span ids | Lowercase or uppercase hex strings, as you provided them.                              |
| Severity           | `severityNumber` (an OTel number) and `severityText` (upper-case name for helpers).    |
| Maps and arrays    | `kvlistValue.values[]` of `{ key, value }`, and `arrayValue.values[]`.                 |
| Unset fields       | Omitted from the JSON.                                                                 |
| Event records      | `eventName` carries the event name.                                                    |
| Dropped attributes | `droppedAttributesCount`, only when greater than zero for helper-made records.         |

## Partial success responses

A `200` JSON response can carry `{"partialSuccess": {"rejectedLogRecords": "2", "errorMessage": "…"}}`. Som surfaces it as a [`partial-success` diagnostic](../guides/diagnostics.md).
