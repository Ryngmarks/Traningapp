import { type ChangeEvent, useRef, useState } from 'react'
import { type ImportLog, useImports, useRunImport } from '@/data/imports'
import { ACTIVITY_LABEL, formatDistance, formatDuration, formatNumber, formatShortDate, SOURCE_LABEL } from '@/domain/format'
import { MAX_IMPORT_BYTES, parseImportFile, type ParsedImport } from '@/domain/importParse'
import { ActivityIcon, Pill } from '@/ui/Badge'
import { Button, IconButton } from '@/ui/Button'
import { Card, SectionTitle } from '@/ui/Card'
import { Icon } from '@/ui/Icon'
import { Screen, SubHeader } from '@/ui/Page'
import { ErrorState, Skeleton } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { importKind } from './helpers'

interface Picked {
  name: string
  kind: 'csv' | 'json'
  parsed: ParsedImport
}

const PREVIEW_ROWS = 5
const SHOWN_ERRORS = 8

export function ImportScreen() {
  const toast = useToast()
  const run = useRunImport()
  const input = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportLog | null>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    setResult(null)
    setPicked(null)
    const kind = importKind(file.name)
    if (!kind) { setFileError('Välj en .csv- eller .json-fil.'); return }
    if (file.size > MAX_IMPORT_BYTES) { setFileError('Filen är för stor (max 2 MB).'); return }
    try {
      const text = await file.text()
      setFileError(null)
      setPicked({ name: file.name, kind, parsed: parseImportFile(text, kind) })
    } catch {
      setFileError('Kunde inte läsa filen.')
    }
  }

  function onImport() {
    if (!picked || picked.parsed.rows.length === 0) return
    run.mutate({ kind: picked.kind, fileName: picked.name, rows: picked.parsed.rows }, {
      onSuccess: (log) => {
        setResult(log)
        setPicked(null)
        toast('Importen är klar')
      },
      onError: (err) => toast(err.message, { tone: 'error' }),
    })
  }

  return (
    <Screen>
      <SubHeader title="Importera" back="/installningar" />

      <input ref={input} type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFile} />

      {!picked && (
        <Card className="flex flex-col items-center px-6 py-8 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-raised text-muted ring-1 ring-line">
            <Icon name="upload" size={26} />
          </div>
          <h2 className="text-[17px] font-semibold">Importera aktiviteter</h2>
          <p className="mt-1.5 max-w-xs text-[14px] text-muted">CSV eller JSON, högst 2 MB. Du ser en förhandsvisning innan något sparas.</p>
          <Button className="mt-5" variant="primary" icon="upload" onClick={() => input.current?.click()}>Välj fil</Button>
          {fileError && <p role="alert" className="mt-3 text-[13px] text-danger">{fileError}</p>}
        </Card>
      )}

      {picked && (
        <Preview picked={picked} importing={run.isPending} onImport={onImport}
          onClear={() => setPicked(null)} onPickAnother={() => input.current?.click()} />
      )}

      {result && <ResultCard log={result} onClose={() => setResult(null)} />}

      <FormatHelp />
      <RecentImports />
    </Screen>
  )
}

function Preview({ picked, importing, onImport, onClear, onPickAnother }: {
  picked: Picked; importing: boolean; onImport: () => void; onClear: () => void; onPickAnother: () => void
}) {
  const { rows, errors } = picked.parsed
  return (
    <div className="space-y-3 animate-fade-in">
      <Card>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{picked.name}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Pill tone={rows.length > 0 ? 'accent' : 'neutral'}>
                <Icon name="check" size={13} strokeWidth={2.25} />{formatNumber(rows.length)} giltiga
              </Pill>
              {errors.length > 0 && <Pill tone="warning">{formatNumber(errors.length)} med fel</Pill>}
            </div>
          </div>
          <IconButton icon="x" label="Avbryt" size={40} onClick={onClear} disabled={importing} />
        </div>

        {errors.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-xl bg-sunken p-3 text-[13px]">
            {errors.slice(0, SHOWN_ERRORS).map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="tabular shrink-0 font-semibold text-warning">{e.line > 0 ? `Rad ${e.line}` : 'Fil'}</span>
                <span className="min-w-0 break-words text-muted">{e.message}</span>
              </li>
            ))}
            {errors.length > SHOWN_ERRORS && <li className="text-faint">… och {errors.length - SHOWN_ERRORS} till</li>}
          </ul>
        )}

        {rows.length > 0 && (
          <>
            <div className="mb-1 mt-4 text-[12px] font-medium text-muted">Förhandsvisning</div>
            <ul className="divide-y divide-line/60">
              {rows.slice(0, PREVIEW_ROWS).map((r, i) => {
                const meta = [
                  r.duration_s != null ? formatDuration(r.duration_s) : null,
                  r.distance_m != null ? formatDistance(r.distance_m) : null,
                  r.steps != null ? `${formatNumber(r.steps)} steg` : null,
                ].filter(Boolean).join(' · ')
                return (
                  <li key={i} className="flex items-center gap-3 py-2">
                    <ActivityIcon type={r.type} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14px] font-medium">{r.title?.trim() || ACTIVITY_LABEL[r.type]}</span>
                        <span className="shrink-0 text-[12px] text-faint">{formatShortDate(r.started_at.slice(0, 10))} {r.started_at.slice(0, 4)}</span>
                      </div>
                      {meta && <div className="tabular truncate text-[12px] text-muted">{meta}</div>}
                    </div>
                  </li>
                )
              })}
            </ul>
            {rows.length > PREVIEW_ROWS && <p className="mt-1 text-[12px] text-faint">+ {formatNumber(rows.length - PREVIEW_ROWS)} till</p>}
          </>
        )}
      </Card>

      {rows.length > 0 ? (
        <Button variant="primary" size="lg" block icon="upload" loading={importing} onClick={onImport}>
          Importera {formatNumber(rows.length)} {rows.length === 1 ? 'aktivitet' : 'aktiviteter'}
        </Button>
      ) : (
        <Button size="lg" block onClick={onPickAnother}>Välj en annan fil</Button>
      )}
      {rows.length > 0 && errors.length > 0 && (
        <p className="px-1 text-center text-[12px] text-faint">Rader med fel hoppas över.</p>
      )}
    </div>
  )
}

function ResultCard({ log, onClose }: { log: ImportLog; onClose: () => void }) {
  return (
    <Card className="mt-3 border-accent/30 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <Icon name="check" size={18} className="text-accent" /> Import klar
        </div>
        <IconButton icon="x" label="Stäng" size={36} onClick={onClose} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <ResultStat label="Tillagda" value={log.inserted_rows} accent />
        <ResultStat label="Dubbletter" value={log.duplicate_rows} />
        <ResultStat label="Fel" value={log.error_rows} />
      </div>
      {log.duplicate_rows > 0 && <p className="mt-3 text-[12px] text-faint">Dubbletter fanns redan och lades inte till igen.</p>}
      {log.error_summary && <p className="mt-2 whitespace-pre-wrap break-words text-[13px] text-warning">{log.error_summary}</p>}
    </Card>
  )
}

function ResultStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className={`tabular font-display text-[24px] font-semibold ${accent ? 'text-accent' : ''}`}>{formatNumber(value)}</div>
    </div>
  )
}

const COLUMNS = ['type', 'started_at', 'duration_s', 'distance_m', 'steps', 'avg_heart_rate', 'perceived_exertion', 'title', 'notes', 'external_id']

function FormatHelp() {
  return (
    <details className="group mt-6 rounded-[var(--radius-card)] border border-line/70 bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
        <Icon name="info" size={18} className="text-muted" />
        <span className="flex-1">Filformat</span>
        <Icon name="chevronDown" size={18} className="text-faint transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 px-4 pb-4 text-[13px] leading-relaxed text-muted">
        <p>En rad per aktivitet. <span className="text-fg">type</span> och <span className="text-fg">started_at</span> krävs, resten är valfritt.</p>
        <div className="flex flex-wrap gap-1.5">
          {COLUMNS.map((c, i) => (
            <code key={c} className={`rounded-md px-1.5 py-0.5 text-[12px] ${i < 2 ? 'bg-accent-soft text-accent' : 'bg-raised text-fg'}`}>{c}</code>
          ))}
        </div>
        <p>Typ: gym, fotbollsträning, match, löpning, promenad eller övrigt (svenska och engelska namn fungerar). Datum som 2026-10-27 eller 2026-10-27T18:30:00+01:00. Tid i sekunder, distans i meter.</p>
        <pre className="overflow-x-auto rounded-xl bg-sunken p-3 text-[12px] text-fg">{'type;started_at;duration_s;distance_m\nlöpning;2026-10-20;1800;5200\nmatch;2026-10-25T15:00:00+02:00;5400;'}</pre>
        <p>CSV med komma eller semikolon, eller JSON (en lista). Det är säkert att importera samma fil igen: redan importerade rader hoppas över.</p>
      </div>
    </details>
  )
}

const dateTime = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function RecentImports() {
  const { data, isPending, error, refetch } = useImports()
  if (!isPending && !error && data.length === 0) return null
  return (
    <>
      <SectionTitle>Tidigare importer</SectionTitle>
      {isPending ? (
        <Skeleton className="h-24 rounded-[var(--radius-card)]" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="-mx-1 rounded-[var(--radius-card)] border border-line/70 bg-surface p-1">
          {data.map((l) => (
            <div key={l.id} className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{l.file_name ?? SOURCE_LABEL[l.source]}</div>
                <div className="truncate text-[12px] text-faint">{dateTime.format(new Date(l.created_at))} · {SOURCE_LABEL[l.source]}</div>
              </div>
              <div className="tabular shrink-0 text-right text-[12px] text-muted">
                <div><span className="font-semibold text-fg">{formatNumber(l.inserted_rows)}</span> tillagda</div>
                {(l.duplicate_rows > 0 || l.error_rows > 0) && (
                  <div className="text-faint">
                    {[l.duplicate_rows > 0 ? `${formatNumber(l.duplicate_rows)} dubbl.` : null, l.error_rows > 0 ? `${formatNumber(l.error_rows)} fel` : null].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
