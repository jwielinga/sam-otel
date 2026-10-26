export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export function formatTimestampNs(timestampNs: string): string {
  return formatTime(new Date(Number(BigInt(timestampNs) / 1_000_000n)))
}
