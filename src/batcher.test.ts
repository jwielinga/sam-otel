import { afterEach, describe, expect, it, vi } from 'vitest'
import { LogBatcher, type LogBatcherOptions } from './batcher.js'

type TestOptions = Omit<Partial<LogBatcherOptions<string>>, 'sendBatch'> & {
  sendBatch?: LogBatcherOptions<string>['sendBatch']
}

function setup(options: TestOptions = {}) {
  const batches: string[][] = []
  const batcher = new LogBatcher<string>({
    ...options,
    sendBatch: async (items) => {
      batches.push([...items])
      await options.sendBatch?.(items)
    },
  })

  return { batcher, batches }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('LogBatcher', () => {
  it('flushes at default threshold of 20 records', async () => {
    const { batcher, batches } = setup()
    const firstNineteen = Array.from({ length: 19 }, (_, index) =>
      batcher.add(`log-${index + 1}`),
    )

    expect(batches).toEqual([])

    const twentieth = batcher.add('log-20')
    await Promise.all([...firstNineteen, twentieth])

    expect(batches).toEqual([
      Array.from({ length: 20 }, (_, index) => `log-${index + 1}`),
    ])
  })

  it('starts default 5-second timer only when logs are queued', async () => {
    vi.useFakeTimers()
    const { batcher, batches } = setup()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(batches).toEqual([])

    const pending = batcher.add('waiting log')
    await vi.advanceTimersByTimeAsync(4_999)
    expect(batches).toEqual([])

    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(batches).toEqual([['waiting log']])
  })

  it('uses configured batch size and timer delay', async () => {
    vi.useFakeTimers()
    const { batcher, batches } = setup({
      maxBatchSize: 10,
      scheduledDelayMs: 250,
    })
    const pending = batcher.add('custom delay')

    await vi.advanceTimersByTimeAsync(249)
    expect(batches).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    await pending

    expect(batches).toEqual([['custom delay']])
  })

  it('caps batches and preserves order while a send is in flight', async () => {
    let notifyRequestStarted!: () => void
    let releaseRequest!: () => void
    const requestStarted = new Promise<void>((resolve) => {
      notifyRequestStarted = resolve
    })
    const { batcher, batches } = setup({
      maxBatchSize: 2,
      scheduledDelayMs: 60_000,
      sendBatch: async () => {
        if (batches.length === 1) {
          notifyRequestStarted()
          await new Promise<void>((resolve) => {
            releaseRequest = resolve
          })
        }
      },
    })
    const firstBatch = [batcher.add('one'), batcher.add('two')]

    await requestStarted
    const queued = [
      batcher.add('three'),
      batcher.add('four'),
      batcher.add('five'),
    ]
    releaseRequest()
    await Promise.all([...firstBatch, ...queued])

    expect(batches).toEqual([['one', 'two'], ['three', 'four'], ['five']])
  })

  it('rejects new entries when pending queue is full', async () => {
    let notifyRequestStarted!: () => void
    let releaseRequest!: () => void
    const requestStarted = new Promise<void>((resolve) => {
      notifyRequestStarted = resolve
    })
    let requestCount = 0
    const { batcher } = setup({
      maxBatchSize: 1,
      maxQueueSize: 1,
      sendBatch: async () => {
        if (requestCount++ === 0) {
          notifyRequestStarted()
          await new Promise<void>((resolve) => {
            releaseRequest = resolve
          })
        }
      },
    })
    const inFlight = batcher.add('in flight')

    await requestStarted
    const queued = batcher.add('queued')
    await expect(batcher.add('rejected')).rejects.toThrow(
      'SamLogger batch queue is full.',
    )

    releaseRequest()
    await Promise.all([inFlight, queued])
  })

  it('rejects entries in a failed batch and accepts later entries', async () => {
    let sendCount = 0
    const { batcher } = setup({
      maxBatchSize: 1,
      sendBatch: async () => {
        if (sendCount++ === 0) throw new Error('collector unavailable')
      },
    })

    await expect(batcher.add('failed')).rejects.toThrow('collector unavailable')
    await expect(batcher.add('recovered')).resolves.toBeUndefined()
  })

  it('flushes on demand and during shutdown', async () => {
    const { batcher, batches } = setup({ scheduledDelayMs: 60_000 })
    const manualFlush = batcher.add('manual')

    await batcher.flush()
    await manualFlush

    const shutdownFlush = batcher.add('shutdown')
    await batcher.shutdown()
    await shutdownFlush

    expect(batches).toEqual([['manual'], ['shutdown']])
    await expect(batcher.add('after shutdown')).rejects.toThrow(
      'LogBatcher has been shut down.',
    )
  })
})
