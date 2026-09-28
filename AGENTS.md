# Agent Guidance

## Project Scope

Sam is a browser-first TypeScript npm package for sending OpenTelemetry logs to an OTLP/HTTP collector. This repository is a library, not a UI application. Do not add app pages, UI components, or demo-site scaffolding unless requested.

The package remains private during development. Keep `private: true` until publication is explicitly approved.

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
