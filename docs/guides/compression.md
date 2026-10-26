---
sidebar_position: 10
title: Compression
---

# Compression

Log batches are text and compress well. Enable gzip to cut request size:

```ts
const logger = createSomLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  compression: 'gzip',
})
```

With `compression: 'gzip'` Som compresses each request body with the browser's `CompressionStream` and adds a `Content-Encoding: gzip` header. The default is `'none'`.

## Things to know

- **Collector support.** The collector must accept gzip request bodies. The OpenTelemetry Collector's OTLP receiver does.
- **CORS.** `Content-Encoding` becomes a request header, so your CORS configuration must allow it. See [Collector setup](./collector-setup.md).
- **Fallback.** Where `CompressionStream` does not exist, Som sends the body uncompressed rather than failing.
- **Page unload.** Unload flushes are never compressed, because compression is asynchronous and the page may be gone. See [Page unload](./page-unload.md).
- **Keepalive size.** Som checks the 64 KiB keepalive limit against the **compressed** size, so compression lets more records use `keepalive` in normal sends.
- **Small batches.** Tiny bodies gain little. Compression pays off with larger batches or long messages.
