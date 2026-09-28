import type { SamLoggerBatchOptions } from './sdk.types.js'

const DEFAULT_MAX_BATCH_SIZE = 20
const DEFAULT_MAX_QUEUE_SIZE = 1_000
const DEFAULT_SCHEDULED_DELAY_MS = 5_000
const MAX_TIMER_DELAY_MS = 2_147_483_647

interface PendingItem<T> {
  item: T
  resolve: () => void
  reject: (error: unknown) => void
}

export interface LogBatcherOptions<T> extends SamLoggerBatchOptions {
  sendBatch: (items: readonly T[]) => Promise<void>
}

export class LogBatcher<T> {
  private readonly maxBatchSize: number
  private readonly maxQueueSize: number
  private readonly flushThreshold: number
  private readonly scheduledDelayMs: number
  private readonly sendBatch: LogBatcherOptions<T>['sendBatch']
  private readonly pendingItems: PendingItem<T>[] = []
  private flushTimer: ReturnType<typeof setTimeout> | undefined
  private activeFlush: Promise<void> | undefined
  private isShutdown = false

  constructor(options: LogBatcherOptions<T>) {
    const maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE
    const maxQueueSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE
    const scheduledDelayMs =
      options.scheduledDelayMs ?? DEFAULT_SCHEDULED_DELAY_MS

    if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1) {
      throw new TypeError('batch.maxBatchSize must be a positive integer.')
    }
    if (!Number.isInteger(maxQueueSize) || maxQueueSize < 1) {
      throw new TypeError('batch.maxQueueSize must be a positive integer.')
    }
    if (
      !Number.isFinite(scheduledDelayMs) ||
      scheduledDelayMs < 0 ||
      scheduledDelayMs > MAX_TIMER_DELAY_MS
    ) {
      throw new TypeError(
        `batch.scheduledDelayMs must be between 0 and ${MAX_TIMER_DELAY_MS}.`,
      )
    }

    this.maxBatchSize = maxBatchSize
    this.maxQueueSize = maxQueueSize
    this.flushThreshold = Math.min(maxBatchSize, maxQueueSize)
    this.scheduledDelayMs = scheduledDelayMs
    this.sendBatch = options.sendBatch
  }

  add(item: T): Promise<void> {
    if (this.isShutdown) {
      return Promise.reject(new Error('LogBatcher has been shut down.'))
    }
    if (this.pendingItems.length >= this.maxQueueSize) {
      return Promise.reject(new Error('SamLogger batch queue is full.'))
    }

    const itemPromise = new Promise<void>((resolve, reject) => {
      this.pendingItems.push({ item, resolve, reject })
    })

    if (this.pendingItems.length >= this.flushThreshold) {
      void this.flush().catch(() => undefined)
    } else {
      this.scheduleFlush()
    }

    return itemPromise
  }

  flush(): Promise<void> {
    this.clearFlushTimer()

    if (this.activeFlush) return this.waitForActiveFlush(this.activeFlush)
    if (this.pendingItems.length === 0) return Promise.resolve()

    return this.startFlush()
  }

  private waitForActiveFlush(activeFlush: Promise<void>): Promise<void> {
    return activeFlush.then(
      () => this.flushPendingItems(),
      (error: unknown) => this.flushAfterFailure(error),
    )
  }

  private async flushPendingItems(): Promise<void> {
    if (this.pendingItems.length > 0) await this.flush()
  }

  private async flushAfterFailure(error: unknown): Promise<void> {
    if (this.pendingItems.length === 0) throw error

    try {
      await this.flush()
    } catch (nextError) {
      throw new AggregateError(
        [error, nextError],
        'Multiple OTLP log batches failed.',
        { cause: nextError },
      )
    }

    throw error
  }

  private startFlush(): Promise<void> {
    const activeFlush = this.drainPendingItems().finally(() => {
      this.finishFlush(activeFlush)
    })
    this.activeFlush = activeFlush
    return activeFlush
  }

  private finishFlush(activeFlush: Promise<void>): void {
    if (this.activeFlush === activeFlush) this.activeFlush = undefined

    if (this.pendingItems.length >= this.flushThreshold) {
      void this.flush().catch(() => undefined)
    } else if (this.pendingItems.length > 0) {
      this.scheduleFlush()
    }
  }

  shutdown(): Promise<void> {
    this.isShutdown = true
    this.clearFlushTimer()
    return this.flush()
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== undefined) return

    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      void this.flush().catch(() => undefined)
    }, this.scheduledDelayMs)
  }

  private clearFlushTimer(): void {
    if (this.flushTimer === undefined) return
    clearTimeout(this.flushTimer)
    this.flushTimer = undefined
  }

  private async drainPendingItems(): Promise<void> {
    const failures: unknown[] = []

    while (this.pendingItems.length > 0) {
      const batch = this.pendingItems.splice(0, this.maxBatchSize)
      try {
        await this.sendBatch(batch.map(({ item }) => item))
        for (const pending of batch) pending.resolve()
      } catch (error) {
        failures.push(error)
        for (const pending of batch) pending.reject(error)
      }
    }

    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) {
      throw new AggregateError(failures, 'Multiple OTLP log batches failed.')
    }
  }
}
