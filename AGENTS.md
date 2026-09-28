# Agent Guidance

## Project Scope

Sam is a browser-first TypeScript npm package for sending OpenTelemetry logs to an OTLP/HTTP collector. This repository is a library, not a UI application. Do not add app pages, UI components, or demo-site scaffolding unless requested.

The package is prepared for public npm releases as `sam-otel`. Releases run through semantic-release on `main` after the repository's npm Trusted Publisher and branch protection are configured.

## Implementation

- Public exports live in `src/index.ts`.
- Keep the initial API focused on logs.
- `SamLogger` batches records into OTLP/HTTP JSON requests, flushing at 20 records or after 5 seconds by default; `batch` options override these thresholds.
- Non-success HTTP responses reject each affected log promise.
- Preserve OTLP log severity and resource fields when changing serialization.
- Update tests and README when public API behavior changes.

## Development

- Use pnpm for package management.
- Run `pnpm check` before considering changes complete.
- Inject `fetcher` in tests; do not require a live collector for unit tests.
