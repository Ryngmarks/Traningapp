/**
 * Autosave queue for workout sets.
 *
 * - Each set is saved independently, keyed by its client-generated id.
 * - Writes for the same set are serialised: while one save is in flight, later
 *   edits are coalesced and sent once it finishes (last write wins, in order).
 * - Edits to values are debounced; completing/undoing a set is sent at once.
 * - Failures stay visible ("error") until a retry succeeds. Nothing is
 *   reported as saved before the server confirmed it.
 * - Because saves are upserts by id, a retried request can never duplicate a set.
 */
export type SyncStatus = 'pending' | 'saving' | 'saved' | 'error'

export type SyncOp<T> = { kind: 'upsert'; id: string; row: T } | { kind: 'delete'; id: string }

export interface SyncQueueOptions<T> {
  save: (op: SyncOp<T>) => Promise<void>
  onStatus: (id: string, status: SyncStatus, error?: unknown) => void
  debounceMs?: number
}

export class SyncQueue<T> {
  private readonly desired = new Map<string, SyncOp<T>>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly inFlight = new Map<string, Promise<void>>()
  private readonly failed = new Set<string>()
  private closed = false
  private readonly opts: Required<SyncQueueOptions<T>>

  constructor(opts: SyncQueueOptions<T>) {
    this.opts = { debounceMs: 600, ...opts }
  }

  /** Queue the latest state of a set. */
  upsert(id: string, row: T, immediate = false): void {
    this.enqueue({ kind: 'upsert', id, row }, immediate)
  }

  /** Queue deletion; supersedes any pending upsert of the same set. */
  delete(id: string): void {
    this.enqueue({ kind: 'delete', id }, true)
  }

  private enqueue(op: SyncOp<T>, immediate: boolean): void {
    if (this.closed) return
    this.desired.set(op.id, op)
    this.failed.delete(op.id)
    this.opts.onStatus(op.id, 'pending')
    const t = this.timers.get(op.id)
    if (t) clearTimeout(t)
    this.timers.delete(op.id)
    if (immediate) void this.flush(op.id)
    else this.timers.set(op.id, setTimeout(() => void this.flush(op.id), this.opts.debounceMs))
  }

  /** Send the latest queued state of one set (waits for an in-flight save first). */
  async flush(id: string): Promise<void> {
    const t = this.timers.get(id)
    if (t) clearTimeout(t)
    this.timers.delete(id)

    const running = this.inFlight.get(id)
    if (running) {
      await running
      // The in-flight save picks up newer state itself when it finishes.
      if (this.inFlight.has(id)) await this.inFlight.get(id)
      return
    }
    const op = this.desired.get(id)
    if (!op || this.closed) return

    const p = this.run(id, op)
    this.inFlight.set(id, p)
    await p
  }

  private async run(id: string, op: SyncOp<T>): Promise<void> {
    this.opts.onStatus(id, 'saving')
    try {
      await this.opts.save(op)
    } catch (error) {
      this.inFlight.delete(id)
      if (this.desired.get(id) !== op) {
        // A newer edit arrived while this failed; try that one instead.
        return this.flush(id)
      }
      this.failed.add(id)
      this.opts.onStatus(id, 'error', error)
      return
    }
    this.inFlight.delete(id)
    if (this.desired.get(id) !== op) {
      // Edited again while saving: send the newer state (unless it is only debounced).
      if (!this.timers.has(id)) return this.flush(id)
      return
    }
    this.desired.delete(id)
    this.opts.onStatus(id, 'saved')
  }

  /** Flush everything now. Resolves when all queued work has been attempted. */
  async flushAll(): Promise<void> {
    const ids = new Set([...this.desired.keys(), ...this.inFlight.keys()])
    await Promise.all([...ids].map((id) => this.flush(id)))
  }

  /** Retry every failed save (e.g. when the browser comes back online). */
  retryFailed(): Promise<void> {
    const ids = [...this.failed]
    this.failed.clear()
    return Promise.all(ids.map((id) => this.flush(id))).then(() => undefined)
  }

  /** True while anything is not confirmed by the server. */
  hasUnsaved(): boolean {
    return this.desired.size > 0 || this.inFlight.size > 0
  }

  failedCount(): number {
    return this.failed.size
  }

  /**
   * Drop all queued work and accept no more (used after the workout is
   * deleted). To leave a screen without losing edits, call flushAll() instead.
   */
  dispose(): void {
    this.closed = true
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
    this.desired.clear()
    this.failed.clear()
  }
}
