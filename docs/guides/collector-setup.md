---
sidebar_position: 12
title: Collector setup
---

# Collector setup

Sam talks to any server that implements the OTLP/HTTP logs endpoint with JSON payloads. This page covers what that server needs, with the OpenTelemetry Collector as the worked example.

## Requirements

- An endpoint that accepts `POST` requests with an OTLP/JSON `ExportLogsServiceRequest` body. The conventional path is `/v1/logs`, and Sam posts to exactly the URL you configure.
- HTTPS in production.
- A **CORS policy** that allows your site, because the browser sends the request cross-origin.
- Support for `Content-Encoding: gzip` if you turn on [compression](./compression.md).

Sam sends these headers, plus any [`headers`](./configuration.md#request-headers) you configure:

| Header             | Value                               |
| ------------------ | ----------------------------------- |
| `Content-Type`     | `application/json`                  |
| `Content-Encoding` | `gzip`, only when compression is on |

## CORS

For a cross-origin request with a `Content-Type: application/json` body, the browser first sends an `OPTIONS` preflight. The collector must answer it, allowing:

- your application's **origin**,
- the methods `POST` and `OPTIONS`,
- the request headers Sam sends: `Content-Type`, `Content-Encoding` when compressing, and any custom headers such as `Authorization`.

If CORS is wrong, the browser blocks the request and Sam sees a network error. In the console you will see a CORS message. Sam retries it as a network failure, then rejects with the browser's original error message.

## OpenTelemetry Collector example

```yaml title="otel-collector.yaml"
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
        cors:
          allowed_origins:
            - https://app.example.com
          allowed_headers:
            - Content-Type
            - Content-Encoding
            - Authorization

exporters:
  debug:
    verbosity: detailed

service:
  pipelines:
    logs:
      receivers: [otlp]
      exporters: [debug]
```

With this configuration, set Sam's `endpoint` to `https://<collector-host>:4318/v1/logs`. Replace the `debug` exporter with the exporter for your backend.

For local development you can allow `http://localhost:*` origins, for example `allowed_origins: ['http://localhost:5173']`.

## Authentication

Browser code cannot keep secrets. Prefer one of:

- A collector or gateway on your own domain that accepts logs without credentials and applies rate limits.
- Short-lived, narrowly scoped tokens issued per session and sent through `headers`.

Remember that custom headers force a preflight, and that the browser may not finish a preflight during page unload.

## Troubleshooting

| Symptom                                       | Likely cause                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Nothing arrives, CORS error in the console    | The collector does not allow your origin or a header Sam sends.                               |
| `OTLP log request failed: 404`                | Wrong `endpoint`. Sam does not append `/v1/logs`.                                             |
| `OTLP log request failed: 400`                | The collector rejected the payload. Check the body and attribute values.                      |
| `OTLP log request failed: 415`                | The receiver does not accept JSON. Enable the OTLP/HTTP receiver.                             |
| Compression enabled and requests fail         | The collector or a proxy does not accept `Content-Encoding: gzip`, or CORS blocks the header. |
| Some logs missing after a successful response | Check for `partial-success` [diagnostics](./diagnostics.md).                                  |
