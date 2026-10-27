import { describe, expect, it } from 'vitest'
import { parseCsv, parseImportFile } from './importParse'

describe('import parsing', () => {
  it('parses quoted CSV fields', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']])
  })

  it('validates rows and reports line numbers', () => {
    const csv = [
      'type,started_at,duration_s,distance_m',
      'run,2026-05-01T07:00:00+02:00,1800,5000',
      'Promenad,2026-05-02,3600,4200',
      'swim,2026-05-03,100,',
      'run,yesterday,,',
    ].join('\n')
    const res = parseImportFile(csv, 'csv')
    expect(res.rows).toHaveLength(2)
    expect(res.rows[1]).toMatchObject({ type: 'walk', started_at: '2026-05-02T12:00:00Z', distance_m: 4200 })
    expect(res.errors.map((e) => e.line)).toEqual([4, 5])
  })

  it('accepts semicolon CSV with decimal commas', () => {
    const res = parseImportFile('type;started_at;distance_m\nrun;2026-05-01;5000', 'csv')
    expect(res.rows).toHaveLength(1)
  })

  it('accepts JSON arrays and rejects bad JSON', () => {
    expect(parseImportFile('[{"type":"gym","started_at":"2026-01-01T10:00:00Z"}]', 'json').rows).toHaveLength(1)
    expect(parseImportFile('{nope', 'json').errors[0]?.message).toBe('Ogiltig JSON')
  })

  it('requires the mandatory columns', () => {
    expect(parseImportFile('foo,bar\n1,2', 'csv').errors[0]?.message).toContain('type och started_at')
  })
})
