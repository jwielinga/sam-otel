#!/bin/sh
set -eu

alloy_url=${ALLOY_URL:-http://localhost:4318}
loki_url=${LOKI_URL:-http://localhost:3100}
marker="som-compose-smoke-$(date +%s)-$$"
timestamp_ns=$(($(date +%s) * 1000000000))
start_seconds=$((timestamp_ns / 1000000000))
end_seconds=$((start_seconds + 60))

payload=$(printf '{"resourceLogs":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"som-compose-smoke"}}]},"scopeLogs":[{"scope":{"name":"smoke-test"},"logRecords":[{"timeUnixNano":"%s","observedTimeUnixNano":"%s","severityNumber":9,"severityText":"INFO","body":{"stringValue":"%s"},"attributes":[]}]}]}]}' "$timestamp_ns" "$timestamp_ns" "$marker")

curl --fail --silent --show-error \
  -H 'Content-Type: application/json' \
  --data "$payload" \
  "${alloy_url%/}/v1/logs" >/dev/null

query="{service_name=\"som-compose-smoke\"} |= \"$marker\""
attempt=0
while [ "$attempt" -lt 30 ]; do
  response=$(curl --fail --silent --show-error --get \
    --data-urlencode "query=$query" \
    --data-urlencode "start=$start_seconds" \
    --data-urlencode "end=$end_seconds" \
    --data-urlencode 'direction=backward' \
    --data-urlencode 'limit=10' \
    "${loki_url%/}/loki/api/v1/query_range")
  case "$response" in
    *"$marker"*)
      printf 'PASS: Loki returned %s\n' "$marker"
      exit 0
      ;;
  esac
  attempt=$((attempt + 1))
  sleep 1
done

printf 'FAIL: Loki did not return %s\n' "$marker" >&2
exit 1