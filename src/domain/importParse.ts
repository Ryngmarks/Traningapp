import { z } from 'zod'
import { ACTIVITY_TYPES } from './types'

/**
 * Client-side parsing and validation of activity import files (CSV or JSON).
 * Only validated, normalised rows are sent to import_activities(), which
 * validates again and deduplicates server side. See docs/INTEGRATIONS.md for
 * the file format.
 */

export const MAX_IMPORT_ROWS = 5000
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

const num = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : typeof v === 'string' ? Number(v.replace(',', '.')) : v),
    z.number().int().min(min).max(max).optional())

const TYPE_ALIASES: Record<string, (typeof ACTIVITY_TYPES)[number]> = {
  gym: 'gym', styrka: 'gym', strength: 'gym',
  football_training: 'football_training', fotbollstraning: 'football_training', fotbollsträning: 'football_training',
  football_match: 'football_match', match: 'football_match', fotbollsmatch: 'football_match',
  walk: 'walk', promenad: 'walk', walking: 'walk',
  run: 'run', lopning: 'run', löpning: 'run', running: 'run',
  other: 'other', ovrigt: 'other', övrigt: 'other',
}

export const importRowSchema = z.object({
  type: z.preprocess(
    (v) => (typeof v === 'string' ? TYPE_ALIASES[v.trim().toLowerCase()] ?? v : v),
    z.enum(ACTIVITY_TYPES, { error: 'okänd aktivitetstyp' }),
  ),
  started_at: z.preprocess(
    (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? `${v.trim()}T12:00:00Z` : v),
    z.iso.datetime({ offset: true, error: 'ogiltigt datum (använd ISO 8601)' }),
  ),
  timezone: z.string().max(64).optional(),
  duration_s: num(0, 86_400),
  distance_m: num(0, 1_000_000),
  steps: num(0, 200_000),
  avg_heart_rate: num(25, 250),
  max_heart_rate: num(25, 250),
  perceived_exertion: num(1, 10),
  title: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  external_id: z.string().max(200).optional(),
})
export type ImportRow = z.infer<typeof importRowSchema>

export interface ParsedImport {
  rows: ImportRow[]
  errors: { line: number; message: string }[]
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f.trim() !== '')) out.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) out.push(row)
  return out
}

function validate(records: unknown[], lineOffset: number): ParsedImport {
  const result: ParsedImport = { rows: [], errors: [] }
  records.forEach((rec, i) => {
    const parsed = importRowSchema.safeParse(rec)
    if (parsed.success) result.rows.push(parsed.data)
    else result.errors.push({ line: i + lineOffset, message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join(', ') })
  })
  return result
}

export function parseImportFile(text: string, kind: 'csv' | 'json'): ParsedImport {
  if (text.length > MAX_IMPORT_BYTES) {
    return { rows: [], errors: [{ line: 0, message: 'Filen är för stor (max 2 MB)' }] }
  }
  let records: unknown[]
  let offset: number
  if (kind === 'json') {
    try {
      const data: unknown = JSON.parse(text)
      records = Array.isArray(data) ? data : (data as { activities?: unknown[] })?.activities ?? []
    } catch {
      return { rows: [], errors: [{ line: 0, message: 'Ogiltig JSON' }] }
    }
    offset = 1
  } else {
    // Swedish spreadsheets export with ';' (and decimal commas).
    const firstLine = text.slice(0, text.search(/\r?\n|$/))
    const delimiter = firstLine.includes(';') ? ';' : ','
    const [header, ...lines] = parseCsv(text, delimiter)
    if (!header) return { rows: [], errors: [{ line: 0, message: 'Tom fil' }] }
    const keys = header.map((h) => h.trim().toLowerCase())
    if (!keys.includes('type') || !keys.includes('started_at')) {
      return { rows: [], errors: [{ line: 1, message: 'Rubrikraden måste innehålla type och started_at' }] }
    }
    records = lines.map((cells) => Object.fromEntries(
      keys.map((k, i) => [k, cells[i]?.trim() ?? '']).filter(([, v]) => v !== ''),
    ))
    offset = 2
  }
  if (records.length > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ line: 0, message: `Högst ${MAX_IMPORT_ROWS} rader per import` }] }
  }
  return validate(records, offset)
}
