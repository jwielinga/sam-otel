import { describe, expect, it, vi } from 'vitest'
import { LogBatcher, type LogBatcherOptions } from './batcher.js'

function blockedFirstSend(options: Partial<LogBatcherOptions<string>> = {}) {
  const batches: string[][] = []
  const unloadBatches: string[][] = []
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  const batcher = new LogBatcher<string>({
    ...options,
    sendBatch: async (items) => {
      batches.push([...items])
      if (batches.length === 1) await gate
    },
    sendBatchOnUnload: async (items) => {
      unloadBatches.push([...items])
    },
  })

  return { batcher, batches, unloadBatches, release }
}

describe('overflowStrategy', () => {
  it('drops the oldest queued record and counts it', async () => {
    const onDropped = vi.fn()
    const { batcher, batches, release } = blockedFirstSend({
      maxBatchSize: 1,
      maxQueueSize: 2,
      overflowStrategy: 'drop-oldest',
      onDropped,
    })
    const inFlight = batcher.add('in flight')
    const oldest = batcher.add('oldest')
    const kept = batcher.add('kept')
    const newest = batcher.add('newest')

    await expect(oldest).rejects.toThrow(
      'SamLogger batch queue is full; oldest record dropped.',
    )
    release()
    await Promise.all([inFlight, kept, newest])

    expect(batches).toEqual([['in flight'], ['kept'], ['newest']])
    expect(batcher.droppedCount).toBe(1)
    expect(onDropped).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('counts records rejected by the default strategy', async () => {
    const onDropped = vi.fn()
    const { batcher, release } = blockedFirstSend({
      maxBatchSize: 1,
      maxQueueSize: 1,
      onDropped,
    })
    const inFlight = batcher.add('in flight')
    const queued = batcher.add('queued')

    await expect(batcher.add('rejected')).rejects.toThrow(
      'SamLogger batch queue is full.',
    )
    release()
    await Promise.all([inFlight, queued])

    expect(batcher.droppedCount).toBe(1)
    expect(onDropped).toHaveBeenCalledWith(1)
  })
})

describe('flushOnUnload', () => {
  it('sends pending items immediately even while a flush is in flight', async () => {
    const { batcher, batches, unloadBatches, release } = blockedFirstSend({
      maxBatchSize: 2,
      scheduledDelayMs: 60_000,
    })
    const first = batcher.add('first')
    void batcher.flush()
    const pending = [batcher.add('a'), batcher.add('b'), batcher.add('c')]

    const unload = batcher.flushOnUnload()

    expect(unloadBatches).toEqual([['a', 'b'], ['c']])
    await unload
    await Promise.all(pending)

    release()
    await first
    expect(batches).toEqual([['first']])
  })

  it('falls back to sendBatch and rejects affected items on failure', async () => {
    const batcher = new LogBatcher<string>({
      scheduledDelayMs: 60_000,
      sendBatch: async () => {
        throw new Error('unload send failed')
      },
    })
    const pending = batcher.add('lost')

    await expect(batcher.flushOnUnload()).rejects.toThrow('unload send failed')
    await expect(pending).rejects.toThrow('unload send failed')
  })

  it('is a no-op when nothing is pending', async () => {
    const { batcher, unloadBatches } = blockedFirstSend()

    await expect(batcher.flushOnUnload()).resolves.toBeUndefined()
    expect(unloadBatches).toEqual([])
  })
})
