import type { SamLoggerBatchOptions } from './sdk.types.js'

const DEFAULT_MAX_BATCH_SIZE = 20
const DEFAULT_MAX_QUEUE_SIZE = 1_000
const DEFAULT_SCHEDULED_DELAY_MS = 5_000
const MAX_TIMER_DELAY_MS = 2_147_483_647

type PendingItem<T> = {
  item: T
  resolve: () => void
  reject: (error: unknown) => void
}

export type LogBatcherOptions<T> = SamLoggerBatchOptions & {
  sendBatch: (items: readonly T[]) => Promise<void>
  // Used by flushOnUnload(); defaults to sendBatch.
  sendBatchOnUnload?: (items: readonly T[]) => Promise<void>
  onDropped?: (totalDropped: number) => void
}

export class LogBatcher<T> {
  private readonly maxBatchSize: number
  private readonly maxQueueSize: number
  private readonly flushThreshold: number
  private readonly scheduledDelayMs: number
  private readonly overflowStrategy: 'reject-new' | 'drop-oldest'
  private readonly sendBatch: LogBatcherOptions<T>['sendBatch']
  private readonly sendBatchOnUnload: LogBatcherOptions<T>['sendBatch']
  private readonly onDropped: LogBatcherOptions<T>['onDropped']
  private readonly pendingItems: PendingItem<T>[] = []
  private flushTimer: ReturnType<typeof setTimeout> | undefined
  private activeFlush: Promise<void> | undefined
  private isShutdown = false
  private totalDropped = 0

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

    const overflowStrategy = options.overflowStrategy ?? 'reject-new'

    this.maxBatchSize = maxBatchSize
    this.maxQueueSize = maxQueueSize
    this.flushThreshold = Math.min(maxBatchSize, maxQueueSize)
    this.scheduledDelayMs = scheduledDelayMs
    this.overflowStrategy = overflowStrategy
    this.sendBatch = options.sendBatch
    this.sendBatchOnUnload = options.sendBatchOnUnload ?? options.sendBatch
    this.onDropped = options.onDropped
  }

  get droppedCount(): number {
    return this.totalDropped
  }

  add(item: T): Promise<void> {
    if (this.isShutdown) {
      return Promise.reject(new Error('LogBatcher has been shut down.'))
    }
    if (this.pendingItems.length >= this.maxQueueSize) {
      if (this.overflowStrategy === 'reject-new') {
        this.recordDrop()
        return Promise.reject(new Error('SamLogger batch queue is full.'))
      }

      const oldest = this.pendingItems.shift()
      this.recordDrop()
      oldest?.reject(
        new Error('SamLogger batch queue is full; oldest record dropped.'),
      )
    }

    const itemPromise = new Promise<void>((resolve, reject) => {
      this.pendingItems.push({ item, resolve, reject })
    })

    if (this.pendingItems.length >= this.flushThreshold) {
      this.flushInBackground()
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
      this.flushInBackground()
    } else if (this.pendingItems.length > 0) {
      this.scheduleFlush()
    }
  }

  // Sends every pending item immediately, without waiting for an in-flight flush.
  flushOnUnload(): Promise<void> {
    this.clearFlushTimer()

    const sends: Promise<void>[] = []
    while (this.pendingItems.length > 0) {
      const batch = this.pendingItems.splice(0, this.maxBatchSize)
      sends.push(this.sendAndSettle(batch, this.sendBatchOnUnload))
    }

    return Promise.allSettled(sends).then((results) => {
      throwFailures(
        results.flatMap((result) =>
          result.status === 'rejected' ? [result.reason as unknown] : [],
        ),
      )
    })
  }

  shutdown(): Promise<void> {
    this.isShutdown = true
    this.clearFlushTimer()
    return this.flush()
  }

  private recordDrop(): void {
    this.totalDropped++
    this.onDropped?.(this.totalDropped)
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== undefined) return

    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      this.flushInBackground()
    }, this.scheduledDelayMs)
  }

  // Failures already reject each affected item's own promise.
  private flushInBackground(): void {
    void this.flush().catch(() => undefined)
  }

  private clearFlushTimer(): void {
    if (this.flushTimer === undefined) return
    clearTimeout(this.flushTimer)
    this.flushTimer = undefined
  }

  private async sendAndSettle(
    batch: PendingItem<T>[],
    send: (items: readonly T[]) => Promise<void>,
  ): Promise<void> {
    try {
      await send(batch.map(({ item }) => item))
    } catch (error) {
      for (const pending of batch) pending.reject(error)
      throw error
    }
    for (const pending of batch) pending.resolve()
  }

  private async drainPendingItems(): Promise<void> {
    const failures: unknown[] = []

    while (this.pendingItems.length > 0) {
      const batch = this.pendingItems.splice(0, this.maxBatchSize)
      try {
        await this.sendAndSettle(batch, this.sendBatch)
      } catch (error) {
        failures.push(error)
      }
    }

    throwFailures(failures)
  }
}

function throwFailures(failures: unknown[]): void {
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Multiple OTLP log batches failed.')
  }
}
