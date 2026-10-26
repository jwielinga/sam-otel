# Som + Grafana + Loki

Browser logs flow from Som to Grafana Alloy over OTLP/HTTP, then to Loki's native OTLP endpoint. Grafana provisions two dashboards: **Browser Logs** and **Error Overview**.

## Run

From this directory:

```sh
docker compose up --build
```

Open the sample app at <http://localhost:8080>. Use the buttons to send React todo-list themed debug, info, warning, error, and fatal events. Each button waits for the export request to succeed. The "How to use the logger" panel at the bottom of the page shows the Som calls behind them.

- Grafana: <http://localhost:3000> (`admin` / `som-demo-only`)
- Browser Logs dashboard: <http://localhost:3000/d/som-browser-logs/browser-logs>
- Error Overview dashboard: <http://localhost:3000/d/som-error-overview/error-overview>
- Alloy OTLP/HTTP receiver: <http://localhost:4318/v1/logs>
- Loki API: <http://localhost:3100>

## Verify ingestion

With the stack running, execute:

```sh
./smoke-test.sh
```

The script posts a uniquely marked OTLP log to Alloy, then queries Loki until that exact log is returned. A successful response proves both ingestion and storage, not just that the receiver is reachable.

The browser app sends real requests through Som and uses the same Alloy receiver. Browser requests are allowed only from `http://localhost:8080` by the local CORS config.

## Stop

```sh
docker compose down
```

Remove the local Grafana and Loki data volumes too:

```sh
docker compose down --volumes
```

This stack is for local development only. It has no authentication on Alloy or Loki, and its Grafana password is intentionally fixed; do not expose these ports to an untrusted network.
