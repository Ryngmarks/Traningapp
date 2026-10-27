import { type KeyboardEvent, type PointerEvent, useState } from 'react'
import { cn } from '../cn'
import { ChartLegend, type ChartSeries, ChartTable, ChartTooltip } from './parts'
import { compactNumber, nearestIndex, rangeTicks } from './scale'
import { useChartWidth } from './useChartWidth'

export interface LineDatum {
  key: string
  /** Position on the time axis (ms). Points are placed by time, not by index. */
  x: number
  /** Axis label for this point (shown for the first and last point). */
  label: string
  /** Tooltip title. */
  title?: string
  values: Record<string, number | null>
}

interface Props {
  data: readonly LineDatum[]
  series: readonly ChartSeries[]
  ariaLabel: string
  height?: number
  formatValue?: (v: number) => string
  className?: string
}

const PAD_TOP = 10
const PAD_BOTTOM = 22
const PAD_RIGHT = 8

/** Line chart on a time axis with a snapping crosshair. One y-axis only. */
export function LineChart({ data, series, ariaLabel, height = 180, formatValue = (v) => String(v), className }: Props) {
  const [ref, width] = useChartWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const all = data.flatMap((d) => series.map((s) => d.values[s.key])).filter((v): v is number => v != null)
  const ticks = rangeTicks(Math.min(...all), Math.max(...all), 3)
  const lo = ticks[0]!
  const hi = ticks[ticks.length - 1]!
  const padLeft = Math.max(20, Math.max(...ticks.map((t) => compactNumber(t).length)) * 6.5 + 8)
  const plotW = Math.max(1, width - padLeft - PAD_RIGHT)
  const plotH = height - PAD_TOP - PAD_BOTTOM
  const xMin = data[0]?.x ?? 0
  const xMax = data[data.length - 1]?.x ?? 1
  const inset = 6
  const xs = data.map((d) => (xMax === xMin ? padLeft + plotW / 2 : padLeft + inset + ((d.x - xMin) / (xMax - xMin)) * (plotW - inset * 2)))
  const y = (v: number) => PAD_TOP + plotH - ((v - lo) / (hi - lo || 1)) * plotH
  const showAllDots = data.length <= 16

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = nearestIndex(xs, e.clientX - rect.left)
    if (i >= 0) setActive(i)
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (data.length === 0) return
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive((a) => (a == null ? 0 : Math.min(data.length - 1, a + 1))) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive((a) => (a == null ? data.length - 1 : Math.max(0, a - 1))) }
    if (e.key === 'Escape') setActive(null)
  }

  function pathFor(key: string): string {
    let d = ''
    let pen = false
    data.forEach((p, i) => {
      const v = p.values[key]
      if (v == null) { pen = false; return }
      d += `${pen ? 'L' : 'M'}${xs[i]!.toFixed(1)},${y(v).toFixed(1)}`
      pen = true
    })
    return d
  }

  const activeDatum = active != null ? data[active] : undefined
  const last = data.length - 1

  return (
    <div className={cn('w-full', className)}>
      <div ref={ref} className="relative w-full">
        {activeDatum && (
          <ChartTooltip
            x={xs[active!]!}
            width={width}
            title={activeDatum.title ?? activeDatum.label}
            rows={series.filter((s) => activeDatum.values[s.key] != null).map((s) => ({
              key: s.key, color: s.color, label: series.length > 1 ? s.label : '', value: formatValue(activeDatum.values[s.key]!),
            }))}
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
              <line x1={padLeft} x2={width - PAD_RIGHT} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={padLeft - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-faint text-[10px]">{compactNumber(t)}</text>
            </g>
          ))}
          {data.length > 0 && (
            <>
              <text x={xs[0]} y={height - 6} textAnchor={data.length > 1 ? 'start' : 'middle'} className="fill-faint text-[10px]">{data[0]!.label}</text>
              {data.length > 1 && <text x={xs[last]} y={height - 6} textAnchor="end" className="fill-faint text-[10px]">{data[last]!.label}</text>}
            </>
          )}
          {activeDatum && (
            <line x1={xs[active!]} x2={xs[active!]} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="var(--color-line-strong)" strokeWidth={1} />
          )}
          {series.map((s) => (
            <g key={s.key}>
              <path d={pathFor(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {data.map((p, i) => {
                const v = p.values[s.key]
                if (v == null || !(showAllDots || i === last || i === active)) return null
                const r = i === active || i === last ? 4.5 : 3
                return <circle key={p.key} cx={xs[i]} cy={y(v)} r={r} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />
              })}
            </g>
          ))}
        </svg>
      </div>
      <ChartLegend series={series} kind="line" className="mt-2.5" />
      <ChartTable
        caption={ariaLabel}
        columns={['', ...series.map((s) => s.label)]}
        rows={data.map((d) => [d.title ?? d.label, ...series.map((s) => { const v = d.values[s.key]; return v == null ? '–' : formatValue(v) })])}
      />
    </div>
  )
}
