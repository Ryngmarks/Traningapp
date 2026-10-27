import { describe, expect, it } from 'vitest'
import { compactNumber, labelStep, nearestIndex, rangeTicks, roundedTopBar, zeroBasedTicks } from './scale'

describe('zeroBasedTicks', () => {
  it('rounds the top up to a clean value', () => {
    expect(zeroBasedTicks(7, 3, true)).toEqual([0, 3, 6, 9])
    expect(zeroBasedTicks(100, 2)).toEqual([0, 50, 100])
    expect(zeroBasedTicks(1240, 3)).toEqual([0, 500, 1000, 1500])
  })
  it('keeps integer steps for counts', () => {
    expect(zeroBasedTicks(2, 3, true)).toEqual([0, 1, 2])
  })
  it('handles an empty series', () => {
    expect(zeroBasedTicks(0, 3, true)).toEqual([0, 1])
  })
})

describe('rangeTicks', () => {
  it('covers min and max', () => {
    const t = rangeTicks(62.5, 80)
    expect(t[0]).toBeLessThanOrEqual(62.5)
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(80)
  })
  it('pads a flat series', () => {
    const t = rangeTicks(60, 60)
    expect(t[0]).toBeLessThan(60)
    expect(t[t.length - 1]).toBeGreaterThan(60)
  })
})

describe('helpers', () => {
  it('formats compact numbers with a decimal comma', () => {
    expect(compactNumber(950)).toBe('950')
    expect(compactNumber(1250)).toBe('1,3k')
    expect(compactNumber(2.5)).toBe('2,5')
  })
  it('thins labels to fit', () => {
    expect(labelStep(7, 320, 3)).toBe(1)
    expect(labelStep(52, 320, 3)).toBeGreaterThan(1)
  })
  it('finds the nearest index', () => {
    expect(nearestIndex([0, 10, 20], 14)).toBe(1)
    expect(nearestIndex([], 1)).toBe(-1)
  })
  it('draws nothing for an empty bar', () => {
    expect(roundedTopBar(0, 0, 10, 0)).toBe('')
    expect(roundedTopBar(0, 0, 10, 20)).toMatch(/^M0,20V4A4,4/)
  })
})
