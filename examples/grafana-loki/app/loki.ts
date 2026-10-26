import { useEffect, useState } from 'react'
import { fetchLokiEntries, type LokiEntry } from './loki-client'

type LokiTail = {
  entries: LokiEntry[]
  error?: string
  updatedAt?: Date
}

export function useLokiTail(intervalMs = 2000): LokiTail {
  const [tail, setTail] = useState<LokiTail>({ entries: [] })

  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined

    const poll = async () => {
      try {
        const entries = await fetchLokiEntries(controller.signal)
        if (controller.signal.aborted) return
        setTail({ entries, updatedAt: new Date() })
      } catch (caught) {
        if (controller.signal.aborted) return
        setTail((current) => ({
          ...current,
          error: caught instanceof Error ? caught.message : String(caught),
        }))
      }

      if (!controller.signal.aborted) {
        timer = window.setTimeout(() => void poll(), intervalMs)
      }
    }

    void poll()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [intervalMs])

  return tail
}
