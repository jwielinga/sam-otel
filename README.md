# Sam

Sam is a lightweight browser-side TypeScript npm package for sending OpenTelemetry logs to an OTLP/HTTP collector. It is a library, not a UI application.

## Package Status

The package name is `sam-otel`. It is prepared for automated publication, but is not available from npm until its first release. For local use, build Sam, then add its repository path to a consuming project with `pnpm add ../sam-otel` (adjust the path as needed). After publication, install it with `pnpm add sam-otel`.

## Quick Start

```ts
import { createSamLogger } from 'sam-otel'

const logger = createSamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'web-app',
  serviceVersion: '1.0.0',
})

await logger.info('User signed in', { userId: 'user-123' })
```

Sam batches logs by default and sends them when it has 20 records or after 5 seconds. Configure `batch.maxBatchSize` and `batch.scheduledDelayMs` to change these thresholds.
Sam batches logs by default and sends them when it has 20 records or after 5 seconds. Configure `batch.maxBatchSize` and `batch.scheduledDelayMs` to change these thresholds.
Sam sets the Fetch `keepalive` flag on requests by default so logs can finish sending during page unload; set `keepalive: false` to disable it. Browsers without support ignore it.

`new SamLogger(options)` remains available for callers that prefer class construction.

See the [user guide](docs/usage.md) for installation, configuration, browser CORS, error handling, and current transport limits.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and commit conventions, and [docs/releasing.md](docs/releasing.md) for the one-time GitHub and npm setup.
See [CONTRIBUTING.md](CONTRIBUTING.md) for development and commit conventions, and [RELEASING.md](RELEASING.md) for the one-time GitHub and npm setup.

## Development

Use Node.js via nvm, pinned to `.nvmrc`:

```sh
nvm install
nvm use
```

```sh
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm check
```

## License

Sam is licensed under EUPL-1.2. See [LICENSE.txt](LICENSE.txt).
