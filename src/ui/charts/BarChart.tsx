import { type KeyboardEvent, type PointerEvent, useState } from 'react'
import { cn } from '../cn'
import { ChartLegend, type ChartSeries, ChartTable, ChartTooltip } from './parts'
import { compactNumber, labelStep, roundedTopBar, zeroBasedTicks } from './scale'
import { useChartWidth } from './useChartWidth'

export interface BarDatum {
  key: string
  /** Short x-axis label ("mån", "v. 44", "okt"). */
  label: string
  /** Longer label for the tooltip and table ("Vecka 44, 26 okt–1 nov"). */
  title?: string
  /** Value per series key. Missing keys count as 0. */
  values: Record<string, number>
}

interface Props {
  data: readonly BarDatum[]
  /** Bottom-to-top stacking order; colour follows the series, never its rank. */
  series: readonly ChartSeries[]
  ariaLabel: string
  height?: number
  formatValue?: (v: number) => string
  /** Integer y ticks (counts). */
  integer?: boolean
  showYAxis?: boolean
  /** Legend for >= 2 series; hide only when the surrounding UI already names them. */
  legend?: boolean
  className?: string
}

const PAD_TOP = 8
const PAD_BOTTOM = 22
const BAR_MAX = 24
const GAP = 2

/** Bar chart (stacked when given several series). Tap or hover a bar to read it. */
export function BarChart({
  data, series, ariaLabel, height = 168, formatValue = (v) => String(v), integer = false,
  showYAxis = true, legend = true, className,
}: Props) {
  const [ref, width] = useChartWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const totals = data.map((d) => series.reduce((s, se) => s + (d.values[se.key] ?? 0), 0))
  const ticks = zeroBasedTicks(Math.max(0, ...totals), 3, integer)
  const top = ticks[ticks.length - 1]!
  const padLeft = showYAxis ? Math.max(18, Math.max(...ticks.map((t) => compactNumber(t).length)) * 6.5 + 8) : 0
  const plotW = Math.max(1, width - padLeft)
  const plotH = height - PAD_TOP - PAD_BOTTOM
  const band = data.length > 0 ? plotW / data.length : plotW
  const barW = Math.max(3, Math.min(BAR_MAX, band * 0.62))
  const y = (v: number) => PAD_TOP + plotH - (v / top) * plotH
  const step = labelStep(data.length, plotW, Math.max(1, ...data.map((d) => d.label.length)))

  function indexAt(clientX: number, el: Element) {
    const rect = el.getBoundingClientRect()
    const i = Math.floor((clientX - rect.left - padLeft) / band)
    return i >= 0 && i < data.length ? i : null
  }
  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const i = indexAt(e.clientX, e.currentTarget)
    if (i != null) setActive(i)
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (data.length === 0) return
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive((a) => (a == null ? 0 : Math.min(data.length - 1, a + 1))) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive((a) => (a == null ? data.length - 1 : Math.max(0, a - 1))) }
    if (e.key === 'Escape') setActive(null)
  }

  const activeDatum = active != null ? data[active] : undefined
  const visibleSeries = series.filter((s) => data.some((d) => (d.values[s.key] ?? 0) > 0))

  return (
    <div className={cn('w-full', className)}>
      <div ref={ref} className="relative w-full">
        {activeDatum && (
          <ChartTooltip
            x={padLeft + band * active! + band / 2}
            width={width}
            title={activeDatum.title ?? activeDatum.label}
            rows={(() => {
              const rows = series
                .filter((s) => (activeDatum.values[s.key] ?? 0) > 0)
                .map((s) => ({ key: s.key, color: s.color, label: series.length > 1 ? s.label : '', value: formatValue(activeDatum.values[s.key]!) }))
              return rows.length > 0 ? rows : [{ key: 'none', color: 'transparent', label: '', value: formatValue(0) }]
            })()}
          />
        )}
        <svg
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full touch-pan-y select-none outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-accent/60"
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null) }}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padLeft} x2={width} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} shapeRendering="crispEdges" />
              {showYAxis && (
                <text x={padLeft - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-faint text-[10px]">{compactNumber(t)}</text>
              )}
            </g>
          ))}
          {data.map((d, i) => {
            const cx = padLeft + band * i + band / 2
            const x = cx - barW / 2
            let base = 0
            const stacked = series.filter((s) => (d.values[s.key] ?? 0) > 0)
            return (
              <g key={d.key} opacity={active == null || active === i ? 1 : 0.4} style={{ transition: 'opacity 150ms' }}>
                {stacked.map((s, si) => {
                  const v = d.values[s.key]!
                  const y0 = y(base)
                  const y1 = y(base + v)
                  base += v
                  const isTop = si === stacked.length - 1
                  const gap = si > 0 ? GAP : 0
                  const h = Math.max(1, y0 - y1 - gap)
                  return isTop
                    ? <path key={s.key} d={roundedTopBar(x, y0 - gap - h, barW, h)} fill={s.color} />
                    : <rect key={s.key} x={x} y={y0 - gap - h} width={barW} height={h} fill={s.color} />
                })}
                {i % step === 0 && (
                  <text x={cx} y={height - 6} textAnchor="middle" className={cn('text-[10px]', active === i ? 'fill-fg' : 'fill-faint')}>{d.label}</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      {legend && <ChartLegend series={visibleSeries} className="mt-2.5" />}
      <ChartTable
        caption={ariaLabel}
        columns={['', ...series.map((s) => s.label)]}
        rows={data.map((d) => [d.title ?? d.label, ...series.map((s) => formatValue(d.values[s.key] ?? 0))])}
      />
    </div>
  )
}
