# Sam

Sam is a lightweight browser-side TypeScript npm package for sending OpenTelemetry logs to an OTLP/HTTP collector. It is a library, not a UI application. The package is private during initial development and cannot be published while `private` is `true` in `package.json`.

## Package Status

The package is not available from the npm registry yet. For local use, build Sam, then add its repository path to a consuming project with `pnpm add ../sam` (adjust the path as needed). After publication, install it with `pnpm add sam`.

## Quick Start

```ts
import { createSamLogger } from 'sam'

const logger = createSamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'web-app',
  serviceVersion: '1.0.0',
})

await logger.info('User signed in', { userId: 'user-123' })
```

Sam batches logs by default and sends them when it has 20 records or after 5 seconds. Configure `batch.maxBatchSize` and `batch.scheduledDelayMs` to change these thresholds.

`new SamLogger(options)` remains available for callers that prefer class construction.

See the [user guide](docs/usage.md) for installation, configuration, browser CORS, error handling, and current transport limits.

## Development

Use Node.js 20.19+ or 22.12+ with pnpm.

```sh
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm check
```
