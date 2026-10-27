import type { ReactNode } from 'react'
import { cn } from '../cn'

export interface ChartSeries {
  key: string
  label: string
  /** CSS colour, e.g. ACTIVITY_COLOR.gym. Marks only; text always uses text tokens. */
  color: string
}

/** Legend for two or more series. Swatch mirrors the mark (rect for bars, line for lines). */
export function ChartLegend({ series, kind = 'bar', className }: { series: readonly ChartSeries[]; kind?: 'bar' | 'line'; className?: string }) {
  if (series.length < 2) return null
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted', className)}>
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={kind === 'bar' ? 'size-2.5 rounded-[3px]' : 'h-0.5 w-3.5 rounded-full'} style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

/** Floating readout above the hovered/tapped mark, clamped inside the chart. */
export function ChartTooltip({ x, width, title, rows }: {
  x: number; width: number; title: ReactNode; rows: { key: string; color: string; label: string; value: string }[]
}) {
  const half = 76
  const left = Math.min(Math.max(x, half), Math.max(half, width - half))
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 min-w-[120px] max-w-[152px] -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded-xl border border-line bg-raised/95 px-2.5 py-2 shadow-xl backdrop-blur-md animate-fade-in"
      style={{ left }}
    >
      <div className="truncate text-[11px] font-medium text-muted">{title}</div>
      {rows.map((r) => (
        <div key={r.key} className="mt-1 flex items-center gap-1.5 text-[12px]">
          <span aria-hidden="true" className="h-0.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
          <span className="tabular font-semibold text-fg">{r.value}</span>
          <span className="truncate text-muted">{r.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Screen-reader table view of the chart data. */
export function ChartTable({ caption, columns, rows }: { caption: string; columns: readonly string[]; rows: readonly (readonly string[])[] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
    </table>
  )
}
