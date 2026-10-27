import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncQueue, type SyncOp, type SyncStatus } from './syncQueue'

type Row = { reps: number }

function setup(save: (op: SyncOp<Row>) => Promise<void>) {
  const statuses: [string, SyncStatus][] = []
  const q = new SyncQueue<Row>({ save, onStatus: (id, s) => statuses.push([id, s]), debounceMs: 500 })
  return { q, statuses }
}

const deferred = () => {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('SyncQueue', () => {
  it('debounces value edits into one save', async () => {
    const save = vi.fn(async () => {})
    const { q } = setup(save)
    q.upsert('a', { reps: 8 })
    q.upsert('a', { reps: 9 })
    q.upsert('a', { reps: 10 })
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ kind: 'upsert', id: 'a', row: { reps: 10 } })
    expect(q.hasUnsaved()).toBe(false)
  })

  it('saves completion immediately', async () => {
    const save = vi.fn(async () => {})
    const { q, statuses } = setup(save)
    q.upsert('a', { reps: 8 }, true)
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(1)
    expect(statuses.at(-1)).toEqual(['a', 'saved'])
  })

  it('serialises writes and sends the newest state after an in-flight save', async () => {
    const d = deferred()
    const save = vi.fn().mockImplementationOnce(() => d.promise).mockImplementation(async () => {})
    const { q, statuses } = setup(save)
    q.upsert('a', { reps: 8 }, true)
    q.upsert('a', { reps: 9 }, true)       // arrives while the first is in flight
    expect(save).toHaveBeenCalledTimes(1)  // never two concurrent writes for a set
    d.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1]![0]).toEqual({ kind: 'upsert', id: 'a', row: { reps: 9 } })
    expect(statuses.at(-1)).toEqual(['a', 'saved'])
  })

  it('reports failures, keeps them unsaved and retries on demand', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    const { q, statuses } = setup(save)
    q.upsert('a', { reps: 8 }, true)
    await vi.advanceTimersByTimeAsync(0)
    expect(statuses.at(-1)).toEqual(['a', 'error'])
    expect(q.hasUnsaved()).toBe(true)
    expect(q.failedCount()).toBe(1)
    await q.retryFailed()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1]![0]).toEqual(save.mock.calls[0]![0]) // same id: idempotent upsert
    expect(statuses.at(-1)).toEqual(['a', 'saved'])
    expect(q.hasUnsaved()).toBe(false)
  })

  it('lets a delete supersede a pending edit', async () => {
    const save = vi.fn(async () => {})
    const { q } = setup(save)
    q.upsert('a', { reps: 8 })
    q.delete('a')
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ kind: 'delete', id: 'a' })
  })

  it('flushAll sends debounced edits right away', async () => {
    const save = vi.fn(async () => {})
    const { q } = setup(save)
    q.upsert('a', { reps: 8 })
    q.upsert('b', { reps: 5 })
    await q.flushAll()
    expect(save).toHaveBeenCalledTimes(2)
    expect(q.hasUnsaved()).toBe(false)
  })

  it('dispose drops queued work and ignores later edits', async () => {
    const save = vi.fn(async () => {})
    const { q } = setup(save)
    q.upsert('a', { reps: 8 })
    q.dispose()
    q.upsert('b', { reps: 5 }, true)
    await vi.advanceTimersByTimeAsync(1000)
    await q.flushAll()
    expect(save).not.toHaveBeenCalled()
    expect(q.hasUnsaved()).toBe(false)
  })
})
