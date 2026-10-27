// Pure scale helpers for the SVG chart kit. No React, no DOM.

/** Round a step up to 1, 2, 2.5 or 5 × 10^n. */
function niceStep(raw: number): number {
  if (raw <= 0 || !Number.isFinite(raw)) return 1
  const exp = Math.floor(Math.log10(raw))
  const base = 10 ** exp
  const f = raw / base
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * base
}

/**
 * Clean ticks from 0 to a round maximum >= `max`. Counts stay integers when
 * `integer` is set (e.g. number of sessions).
 */
export function zeroBasedTicks(max: number, count = 3, integer = false): number[] {
  if (!(max > 0)) return [0, integer ? 1 : 1]
  let step = niceStep(max / count)
  if (integer) step = Math.max(1, Math.ceil(step))
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(round(v))
  return ticks
}

/** Clean ticks covering [min, max] for line charts that need not start at zero. */
export function rangeTicks(min: number, max: number, count = 3): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1
    min -= pad
    max += pad
  }
  const step = niceStep((max - min) / count)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(round(v))
  return ticks
}

function round(v: number): number {
  return Math.round(v * 1e6) / 1e6
}

/** Compact axis label: 950 → "950", 1200 → "1,2k", 25000 → "25k" (Swedish decimal comma). */
export function compactNumber(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1000) {
    const k = v / 1000
    return `${(Math.round(k * 10) / 10).toString().replace('.', ',')}k`
  }
  return (Math.round(v * 10) / 10).toString().replace('.', ',')
}

/** Show every n-th x label so that labels of `chars` characters fit in `width` px. */
export function labelStep(count: number, width: number, chars: number, charPx = 6.4, gapPx = 10): number {
  if (count <= 1 || width <= 0) return 1
  const per = chars * charPx + gapPx
  const fits = Math.max(1, Math.floor(width / per))
  return Math.max(1, Math.ceil(count / fits))
}

/** Index of the value in a sorted array closest to `x`. */
export function nearestIndex(sorted: readonly number[], x: number): number {
  if (sorted.length === 0) return -1
  let best = 0
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i]! - x) < Math.abs(sorted[best]! - x)) best = i
  }
  return best
}

/** SVG path for a bar with a rounded data end (top) and a square base. */
export function roundedTopBar(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return ''
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h}V${y + rr}A${rr},${rr} 0 0 1 ${x + rr},${y}H${x + w - rr}A${rr},${rr} 0 0 1 ${x + w},${y + rr}V${y + h}Z`
}
