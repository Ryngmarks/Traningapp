/**
 * Database security and RPC behaviour tests.
 *
 * Runs against a throwaway PostgreSQL database prepared by
 * supabase/tests/reset-local-db.sh (Supabase auth shim + all migrations).
 * Each test impersonates a user exactly like PostgREST does: SET ROLE
 * authenticated + request.jwt.claims, inside a transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const resetScript = fileURLToPath(new URL('./reset-local-db.sh', import.meta.url))

let pool: pg.Pool
let userA: string
let userB: string

type Q = <T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]) => Promise<pg.QueryResult<T>>

/** Run fn as the given user (or anon when null); always rolled back. */
async function as<T>(uid: string | null, fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(`set local role ${uid ? 'authenticated' : 'anon'}`)
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(uid ? { sub: uid, role: 'authenticated' } : { role: 'anon' }),
    ])
    const q: Q = (sql, params) => client.query(sql, params)
    return await fn(q)
  } finally {
    await client.query('rollback')
    client.release()
  }
}

/** Expect the statement to fail; returns the Postgres error code. */
async function failCode(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return (e as { code?: string }).code ?? 'unknown'
  }
  throw new Error('expected statement to fail')
}

const ALL_USER_TABLES = [
  'profiles', 'exercises', 'workout_templates', 'template_exercises', 'imports',
  'activities', 'activity_metrics', 'performed_exercises', 'performed_sets',
  'historical_totals', 'daily_metrics', 'heart_rate_samples', 'members',
]

// Shared with every member by design (docs/SECURITY.md → Delning). Everything
// else is private to its owner.
const SHARED_TABLES = ['exercises', 'workout_templates', 'template_exercises', 'members']

// Fixture ids owned by user A, created once with the superuser connection.
const fx = {
  exercise: '', template: '', templateExercise: '', activity: '', performedExercise: '',
  set: '', total: '', importId: '',
}

beforeAll(async () => {
  const url = execFileSync('bash', [resetScript], { encoding: 'utf8' }).trim().split('\n').pop()!
  pool = new pg.Pool({ connectionString: url, max: 4 })

  const users = await pool.query<{ id: string }>(
    `insert into auth.users (email) values ('a@example.test'), ('b@example.test') returning id`,
  )
  userA = users.rows[0].id
  userB = users.rows[1].id

  // Build A's data through the same paths the app uses, as A.
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query('set local role authenticated')
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userA })])
    fx.exercise = (await client.query(
      `insert into exercises (owner_id, name, category) values ($1, 'A privat övning', 'legs') returning id`, [userA],
    )).rows[0].id
    await client.query(`update profiles set display_name = 'Anna', timezone = 'Europe/Oslo' where id = $1`, [userA])
    fx.template = (await client.query(`select save_template(null, 'A mall', null, $1::jsonb) as id`, [JSON.stringify([
      { exercise_id: (await client.query(`select id from exercises where slug = 'back_squat'`)).rows[0].id, warmup_sets: 1, planned_sets: 2, rep_min: 5, rep_max: 8 },
      { exercise_id: fx.exercise, planned_sets: 2, rep_min: 8, rep_max: 12 },
    ])])).rows[0].id
    fx.templateExercise = (await client.query(`select id from template_exercises where template_id = $1 order by position limit 1`, [fx.template])).rows[0].id
    fx.activity = (await client.query(`select start_workout($1, 'Europe/Stockholm') as id`, [fx.template])).rows[0].id
    const pe = await client.query(
      `select pe.id as peid, s.id as sid from performed_exercises pe join performed_sets s on s.performed_exercise_id = pe.id
       where pe.activity_id = $1 order by pe.position, s.position limit 1`, [fx.activity],
    )
    fx.performedExercise = pe.rows[0].peid
    fx.set = pe.rows[0].sid
    await client.query(`insert into activity_metrics (activity_id, steps) values ($1, 100)`, [fx.activity])
    fx.total = (await client.query(
      `insert into historical_totals (activity_type, session_count, covers_until) values ('gym', 110, '2026-01-01') returning id`,
    )).rows[0].id
    fx.importId = (await client.query(
      `select (import_activities('import_csv', 'a.csv', '[{"type":"walk","started_at":"2026-05-01T08:00:00Z","distance_m":3000}]'::jsonb)).id as id`,
    )).rows[0].id
    await client.query('commit')
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
  // Health tables have no client write path yet; seed them as superuser.
  await pool.query(`insert into daily_metrics (user_id, date, source, steps) values ($1, '2026-05-01', 'apple_health', 9000)`, [userA])
  await pool.query(`insert into heart_rate_samples (user_id, recorded_at, bpm, source) values ($1, now(), 60, 'apple_health')`, [userA])
}, 60_000)

afterAll(async () => {
  await pool?.end()
})

describe('schema hardening', () => {
  it('has RLS enabled on every table in public', async () => {
    const res = await pool.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    )
    expect(res.rows.map((r) => r.relname)).toEqual([])
  })

  it('covers every public table in these tests', async () => {
    const res = await pool.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' order by 1`,
    )
    expect(res.rows.map((r) => r.relname).sort()).toEqual([...ALL_USER_TABLES].sort())
  })

  it('gives anon no table or function access', async () => {
    for (const table of ALL_USER_TABLES) {
      expect(await failCode(as(null, (q) => q(`select 1 from ${table} limit 1`)))).toBe('42501')
    }
    expect(await failCode(as(null, (q) => q(`select start_workout()`)))).toBe('42501')
    expect(await failCode(as(null, (q) => q(`select last_performances('{}')`)))).toBe('42501')
  })

  it('does not let members write the members directory', async () => {
    expect(await failCode(as(userB, (q) => q(`update members set display_name = 'x' where user_id = $1`, [userA])))).toBe('42501')
    expect(await failCode(as(userB, (q) => q(`insert into members (user_id, display_name) values ($1, 'x')`, [userB])))).toBe('42501')
    expect(await failCode(as(userB, (q) => q(`delete from members where user_id = $1`, [userA])))).toBe('42501')
  })
})

describe('tenant isolation: user B against user A data', () => {
  const ownedBy: Record<string, [string, string]> = {
    profiles: ['id', 'userA'],
    exercises: ['id', 'exercise'],
    workout_templates: ['id', 'template'],
    template_exercises: ['id', 'templateExercise'],
    activities: ['id', 'activity'],
    activity_metrics: ['activity_id', 'activity'],
    performed_exercises: ['id', 'performedExercise'],
    performed_sets: ['id', 'set'],
    historical_totals: ['id', 'total'],
    imports: ['id', 'importId'],
  }
  const idOf = (key: string) => (key === 'userA' ? userA : fx[key as keyof typeof fx])

  it('SELECT: B sees none of A\'s rows in any private table', async () => {
    await as(userB, async (q) => {
      for (const table of ALL_USER_TABLES.filter((t) => !SHARED_TABLES.includes(t))) {
        const col = table === 'profiles' ? 'id' : table === 'exercises' ? 'owner_id' : 'user_id'
        const res = await q(`select 1 from ${table} where ${col} = $1`, [userA])
        expect(res.rowCount, table).toBe(0)
      }
    })
  })

  it('SELECT: A sees their own rows (sanity check of the fixture)', async () => {
    await as(userA, async (q) => {
      for (const [table, [col, key]] of Object.entries(ownedBy)) {
        const res = await q(`select 1 from ${table} where ${col} = $1`, [idOf(key)])
        expect(res.rowCount, table).toBe(1)
      }
    })
  })

  it('UPDATE: B cannot change A\'s rows', async () => {
    await as(userB, async (q) => {
      const updates: Record<string, string> = {
        profiles: `display_name = 'hacked'`,
        exercises: `name = 'hacked'`,
        workout_templates: `name = 'hacked'`,
        template_exercises: `planned_sets = 9`,
        activities: `notes = 'hacked'`,
        activity_metrics: `steps = 1`,
        performed_exercises: `notes = 'hacked'`,
        performed_sets: `reps = 99`,
        historical_totals: `session_count = 1`,
        imports: `error_rows = 9`,
      }
      for (const [table, [col, key]] of Object.entries(ownedBy)) {
        const res = await q(`update ${table} set ${updates[table]} where ${col} = $1`, [idOf(key)])
        expect(res.rowCount, table).toBe(0)
      }
    })
  })

  it('DELETE: B cannot delete A\'s rows', async () => {
    await as(userB, async (q) => {
      for (const [table, [col, key]] of Object.entries(ownedBy)) {
        if (table === 'profiles') continue
        const res = await q(`delete from ${table} where ${col} = $1`, [idOf(key)])
        expect(res.rowCount, table).toBe(0)
      }
    })
    // Profiles have no delete grant at all.
    expect(await failCode(as(userB, (q) => q(`delete from profiles where id = $1`, [userA])))).toBe('42501')
    const still = await pool.query(`select 1 from activities where id = $1`, [fx.activity])
    expect(still.rowCount).toBe(1)
  })

  it('INSERT: B cannot create rows owned by A', async () => {
    const attempts: string[] = [
      `insert into exercises (owner_id, name, category) values ('${'$'}A', 'x', 'legs')`,
      `insert into workout_templates (user_id, name) values ('${'$'}A', 'x')`,
      `insert into activities (user_id, type, started_at) values ('${'$'}A', 'run', now())`,
      `insert into historical_totals (user_id, activity_type, session_count, covers_until) values ('${'$'}A', 'gym', 1, current_date)`,
      `insert into imports (user_id, source) values ('${'$'}A', 'import_csv')`,
    ]
    for (const sql of attempts) {
      const code = await failCode(as(userB, (q) => q(sql.replace('$A', userA))))
      expect(code, sql).toBe('42501')
    }
  })

  it('INSERT: B cannot attach children to A\'s parents', async () => {
    // B's own user_id + A's parent id: the composite FK rejects it.
    const cases: [string, unknown[]][] = [
      [`insert into template_exercises (template_id, exercise_id, position) values ($1, (select id from exercises where slug = 'plank'), 99)`, [fx.template]],
      [`insert into performed_exercises (activity_id, exercise_name, category, measurement_type, position) values ($1, 'x', 'legs', 'weight_reps', 99)`, [fx.activity]],
      [`insert into performed_sets (performed_exercise_id, position) values ($1, 99)`, [fx.performedExercise]],
      [`insert into activity_metrics (activity_id, steps) values ($1, 1)`, [fx.activity]],
    ]
    for (const [sql, params] of cases) {
      const code = await failCode(as(userB, (q) => q(sql, params)))
      // 23505: activity_metrics is keyed by activity_id, so the PK fires first.
      expect(['23503', '42501', '23505'], sql).toContain(code)
    }
  })

  it('SHARED: B can read A\'s templates, exercises and name, nothing else of A\'s profile', async () => {
    await as(userB, async (q) => {
      expect((await q(`select 1 from workout_templates where id = $1`, [fx.template])).rowCount).toBe(1)
      expect((await q(`select 1 from template_exercises where template_id = $1`, [fx.template])).rowCount).toBe(2)
      expect((await q(`select 1 from exercises where id = $1`, [fx.exercise])).rowCount).toBe(1)
      expect((await q<{ display_name: string }>(`select display_name from members where user_id = $1`, [userA])).rows)
        .toEqual([{ display_name: 'Anna' }])
      expect((await q(`select 1 from profiles where id = $1`, [userA])).rowCount).toBe(0)
    })
  })

  it('SHARED: B can use A\'s exercise in own template and workout', async () => {
    await as(userB, async (q) => {
      const tpl = (await q<{ id: string }>(`insert into workout_templates (name) values ('B') returning id`)).rows[0].id
      await q(`insert into template_exercises (template_id, exercise_id, position) values ($1, $2, 0)`, [tpl, fx.exercise])
      const act = (await q<{ id: string }>(`select start_workout() as id`)).rows[0].id
      const peId = (await q<{ id: string }>(`select add_performed_exercise($1, $2, 0) as id`, [act, fx.exercise])).rows[0].id
      const pe = await q<{ exercise_name: string }>(`select exercise_name from performed_exercises where id = $1`, [peId])
      expect(pe.rows[0].exercise_name).toBe('A privat övning')
    })
  })

  it('UPDATE: B cannot move own rows to A', async () => {
    await as(userB, async (q) => {
      const id = (await q<{ id: string }>(`insert into workout_templates (name) values ('B') returning id`)).rows[0].id
      expect(await failCode(q(`update workout_templates set user_id = $1 where id = $2`, [userA, id]))).toBe('42501')
    })
  })

  it('RPC: B can start A\'s template, but the workout is B\'s and not linked to A\'s template', async () => {
    await as(userB, async (q) => {
      const act = (await q<{ id: string }>(`select start_workout($1) as id`, [fx.template])).rows[0].id
      const a = await q<{ user_id: string; template_id: string | null; template_name: string }>(
        `select user_id, template_id, template_name from activities where id = $1`, [act])
      expect(a.rows[0]).toEqual({ user_id: userB, template_id: null, template_name: 'A mall' })
      expect((await q(`select 1 from performed_exercises where activity_id = $1`, [act])).rowCount).toBe(2)
    })
  })

  it('RPC: B cannot finish A\'s workout, change A\'s template or read A\'s history', async () => {
    expect(await failCode(as(userB, (q) => q(`select finish_workout($1)`, [fx.activity])))).toBe('P0002')
    expect(await failCode(as(userB, (q) => q(`select save_template($1, 'x', null, '[]'::jsonb)`, [fx.template])))).toBe('P0002')
    const res = await as(userB, (q) => q(`select * from last_performances(array[(select id from exercises where slug = 'back_squat')])`))
    expect(res.rowCount).toBe(0)
  })
})

describe('global exercise library', () => {
  it('is readable but not writable by users', async () => {
    await as(userB, async (q) => {
      const count = await q<{ n: number }>(`select count(*)::int as n from exercises where owner_id is null`)
      expect(count.rows[0].n).toBeGreaterThanOrEqual(30)
      const upd = await q(`update exercises set name = 'x' where slug = 'back_squat'`)
      expect(upd.rowCount).toBe(0)
      const del = await q(`delete from exercises where slug = 'back_squat'`)
      expect(del.rowCount).toBe(0)
      expect(await failCode(q(`insert into exercises (name, category, slug) values ('x', 'legs', 'x')`))).toBe('42501')
    })
  })

  it('lets users create and edit their own exercises', async () => {
    await as(userB, async (q) => {
      const id = (await q<{ id: string }>(
        `insert into exercises (owner_id, name, category, measurement_type) values ($1, 'Min övning', 'core', 'duration') returning id`, [userB],
      )).rows[0].id
      const upd = await q(`update exercises set name = 'Ny' where id = $1`, [id])
      expect(upd.rowCount).toBe(1)
    })
  })
})

describe('profiles', () => {
  it('are created on sign up with a member entry and no personal templates', async () => {
    await as(userB, async (q) => {
      expect((await q(`select 1 from profiles`)).rowCount).toBe(1)
      expect((await q(`select 1 from members where user_id = $1`, [userB])).rowCount).toBe(1)
      expect((await q(`select 1 from workout_templates where user_id = $1`, [userB])).rowCount).toBe(0)
    })
  })

  it('share four read-only global starter templates', async () => {
    await as(userB, async (q) => {
      const tpl = await q<{ name: string; n: number }>(
        `select t.name, count(te.id)::int as n from workout_templates t join template_exercises te on te.template_id = t.id
         where t.user_id is null group by t.name order by t.name`,
      )
      expect(tpl.rows).toEqual([
        { name: 'Helkropp A', n: 6 }, { name: 'Helkropp B', n: 6 }, { name: 'Underkropp', n: 6 }, { name: 'Överkropp', n: 6 },
      ])
      expect((await q(`update workout_templates set name = 'x' where user_id is null`)).rowCount).toBe(0)
      expect((await q(`delete from template_exercises where user_id is null`)).rowCount).toBe(0)
    })
  })

  it('reject an invalid timezone', async () => {
    expect(await failCode(as(userB, (q) => q(`update profiles set timezone = 'Mars/Olympus'`)))).toBe('22023')
  })
})

describe('gym workflow RPCs', () => {
  it('prefills planned sets from the last completed performance', async () => {
    await as(userB, async (q) => {
      const squat = (await q<{ id: string }>(`select id from exercises where slug = 'back_squat'`)).rows[0].id
      const tpl = await q<{ id: string }>(`select save_template(null, 'Ben', null, $1::jsonb) as id`, [
        JSON.stringify([{ exercise_id: squat, warmup_sets: 1, planned_sets: 2, rep_min: 8, rep_max: 12 }]),
      ])
      const first = (await q<{ id: string }>(`select start_workout($1) as id`, [tpl.rows[0].id])).rows[0].id
      const sets = await q<{ kind: string; reps: number; weight_kg: string | null }>(
        `select s.kind, s.reps, s.weight_kg from performed_sets s join performed_exercises pe on pe.id = s.performed_exercise_id
         where pe.activity_id = $1 order by s.position`, [first],
      )
      // No history yet: working sets start at the bottom of the rep range.
      expect(sets.rows).toEqual([
        { kind: 'warmup', reps: null, weight_kg: null },
        { kind: 'working', reps: 8, weight_kg: null },
        { kind: 'working', reps: 8, weight_kg: null },
      ])
      await q(`update performed_sets s set weight_kg = 60 + s.position, reps = 10 + s.position, completed_at = now()
               from performed_exercises pe where pe.id = s.performed_exercise_id and pe.activity_id = $1`, [first])
      await q(`select finish_workout($1)`, [first])

      const second = (await q<{ id: string }>(`select start_workout($1) as id`, [tpl.rows[0].id])).rows[0].id
      const prefilled = await q<{ kind: string; reps: number; weight_kg: string; completed_at: string | null }>(
        `select s.kind, s.reps, s.weight_kg, s.completed_at from performed_sets s join performed_exercises pe on pe.id = s.performed_exercise_id
         where pe.activity_id = $1 order by s.position`, [second],
      )
      expect(prefilled.rows).toEqual([
        { kind: 'warmup', reps: 10, weight_kg: '60.00', completed_at: null },
        { kind: 'working', reps: 11, weight_kg: '61.00', completed_at: null },
        { kind: 'working', reps: 12, weight_kg: '62.00', completed_at: null },
      ])

      const last = await q<{ sets: { reps: number }[]; rep_max: number }>(`select * from last_performances(array[$1]::uuid[])`, [squat])
      expect(last.rows[0].rep_max).toBe(12)
      expect(last.rows[0].sets.map((s) => s.reps)).toEqual([10, 11, 12])
    })
  })

  it('allows only one workout in progress', async () => {
    await as(userB, async (q) => {
      await q(`select start_workout()`)
      expect(await failCode(q(`select start_workout()`))).toBe('23505')
    })
  })

  it('finishing keeps only completed sets and is not repeatable', async () => {
    await as(userB, async (q) => {
      const tpl = (await q<{ id: string }>(`select id from workout_templates where name = 'Helkropp A'`)).rows[0].id
      const act = (await q<{ id: string }>(`select start_workout($1) as id`, [tpl])).rows[0].id
      const first = (await q<{ id: string }>(
        `select s.id from performed_sets s join performed_exercises pe on pe.id = s.performed_exercise_id
         where pe.activity_id = $1 order by pe.position, s.position limit 1`, [act],
      )).rows[0].id
      await q(`update performed_sets set reps = 5, completed_at = now() where id = $1`, [first])
      await q(`select finish_workout($1)`, [act])
      const left = await q(`select s.id from performed_sets s join performed_exercises pe on pe.id = s.performed_exercise_id where pe.activity_id = $1`, [act])
      expect(left.rows).toEqual([{ id: first }])
      const exs = await q(`select 1 from performed_exercises where activity_id = $1`, [act])
      expect(exs.rowCount).toBe(1)
      const a = await q<{ status: string; duration_s: number; local_date: string }>(`select status, duration_s from activities where id = $1`, [act])
      expect(a.rows[0].status).toBe('completed')
      expect(a.rows[0].duration_s).toBeGreaterThanOrEqual(0)
      expect(await failCode(q(`select finish_workout($1)`, [act]))).toBe('P0002')
    })
  })

  it('makes set saves idempotent through client-generated ids', async () => {
    await as(userB, async (q) => {
      const act = (await q<{ id: string }>(`select start_workout() as id`)).rows[0].id
      const pe = (await q<{ id: string }>(`select add_performed_exercise($1, (select id from exercises where slug = 'plank'), 0, 0, 0) as id`, [act])).rows[0].id
      const id = '0b9d6b0e-7f43-4b3c-9d61-1a2b3c4d5e6f'
      const upsert = `insert into performed_sets (id, performed_exercise_id, position, duration_s, completed_at)
                      values ($1, $2, 0, 45, now()) on conflict (id) do update set duration_s = excluded.duration_s`
      await q(upsert, [id, pe])
      await q(upsert, [id, pe])
      const n = await q(`select 1 from performed_sets where performed_exercise_id = $1`, [pe])
      expect(n.rowCount).toBe(1)
    })
  })

  it('editing a template does not change past workouts', async () => {
    await as(userB, async (q) => {
      const squat = (await q<{ id: string }>(`select id from exercises where slug = 'back_squat'`)).rows[0].id
      const tpl = (await q<{ id: string }>(`select save_template(null, 'Mitt pass', null, $1::jsonb) as id`,
        [JSON.stringify([{ exercise_id: squat, planned_sets: 3 }, { exercise_id: squat, planned_sets: 2 }])])).rows[0].id
      const act = (await q<{ id: string }>(`select start_workout($1) as id`, [tpl])).rows[0].id
      await q(`select save_template($1, 'Omdöpt', null, '[]'::jsonb)`, [tpl])
      const a = await q<{ template_name: string }>(`select template_name from activities where id = $1`, [act])
      expect(a.rows[0].template_name).toBe('Mitt pass')
      const n = await q(`select 1 from performed_exercises where activity_id = $1`, [act])
      expect(n.rowCount).toBe(2)
      await q(`delete from workout_templates where id = $1`, [tpl])
      const after = await q<{ template_id: string | null }>(`select template_id from activities where id = $1`, [act])
      expect(after.rows[0].template_id).toBeNull()
    })
  })
})

describe('correcting workout time', () => {
  it('finishes with an earlier end time and lets the owner adjust start and length later', async () => {
    await as(userB, async (q) => {
      const act = (await q<{ id: string }>(`select start_workout() as id`)).rows[0].id
      await q(`update activities set started_at = now() - interval '3 hours' where id = $1`, [act])
      await q(`select finish_workout($1, now() - interval '2 hours')`, [act])
      const a = await q<{ duration_s: number }>(`select duration_s from activities where id = $1`, [act])
      expect(a.rows[0].duration_s).toBe(3600)
      await q(`update activities set started_at = '2026-03-01T22:30:00Z', ended_at = '2026-03-01T23:45:00Z', duration_s = 4500 where id = $1`, [act])
      const b = await q<{ duration_s: number; local_date: string }>(`select duration_s, to_char(local_date, 'YYYY-MM-DD') as local_date from activities where id = $1`, [act])
      expect(b.rows[0]).toEqual({ duration_s: 4500, local_date: '2026-03-01' })
      expect(await failCode(q(`update activities set ended_at = started_at - interval '1 minute' where id = $1`, [act]))).toBe('23514')
    })
  })
})

describe('cardio sets', () => {
  it('store time, distance, speed, incline and calories and prefill them next time', async () => {
    await as(userB, async (q) => {
      const treadmill = (await q<{ id: string; measurement_type: string }>(`select id, measurement_type from exercises where slug = 'treadmill'`)).rows[0]
      expect(treadmill.measurement_type).toBe('cardio')
      const first = (await q<{ id: string }>(`select start_workout() as id`)).rows[0].id
      const pe = (await q<{ id: string }>(`select add_performed_exercise($1, $2, 0, 0, 1) as id`, [first, treadmill.id])).rows[0].id
      await q(`update performed_sets set duration_s = 1800, distance_m = 5200, speed_kmh = 10.5, incline_pct = 2, calories = 320, completed_at = now()
               where performed_exercise_id = $1`, [pe])
      await q(`select finish_workout($1)`, [first])
      const second = (await q<{ id: string }>(`select start_workout() as id`)).rows[0].id
      const pe2 = (await q<{ id: string }>(`select add_performed_exercise($1, $2, 0, 0, 1) as id`, [second, treadmill.id])).rows[0].id
      const s2 = await q(`select duration_s, distance_m, speed_kmh::float, incline_pct::float, calories, completed_at from performed_sets where performed_exercise_id = $1`, [pe2])
      expect(s2.rows).toEqual([{ duration_s: 1800, distance_m: 5200, speed_kmh: 10.5, incline_pct: 2, calories: 320, completed_at: null }])
      const last = await q<{ sets: { speed_kmh: number; calories: number }[] }>(`select sets from last_performances(array[$1]::uuid[])`, [treadmill.id])
      expect(last.rows[0].sets[0]).toMatchObject({ speed_kmh: 10.5, calories: 320 })
      expect(await failCode(q(`update performed_sets set speed_kmh = 99 where performed_exercise_id = $1`, [pe2]))).toBe('23514')
    })
  })
})

describe('activities and imports', () => {
  it('derives local_date from the activity timezone', async () => {
    await as(userB, async (q) => {
      const res = await q<{ local_date: string }>(
        `insert into activities (type, started_at, timezone, duration_s) values ('run', '2026-03-01T23:30:00Z', 'Europe/Stockholm', 1800)
         returning to_char(local_date, 'YYYY-MM-DD') as local_date`,
      )
      expect(res.rows[0].local_date).toBe('2026-03-02')
    })
  })

  it('only gym sessions can be in progress', async () => {
    expect(await failCode(as(userB, (q) => q(`insert into activities (type, status, started_at) values ('run', 'in_progress', now())`)))).toBe('23514')
  })

  it('imports idempotently and reports bad rows', async () => {
    await as(userB, async (q) => {
      const rows = JSON.stringify([
        { type: 'run', started_at: '2026-04-01T06:00:00Z', duration_s: 1800, distance_m: 5000 },
        { type: 'football_training', started_at: '2026-04-02T17:00:00Z', duration_s: 5400, external_id: 'ext-1' },
        { type: 'swimming', started_at: '2026-04-03T17:00:00Z' },
        { type: 'walk', started_at: 'not a date' },
      ])
      const first = await q<{ inserted_rows: number; duplicate_rows: number; error_rows: number; error_summary: string }>(
        `select * from import_activities('import_csv', 'f.csv', $1::jsonb)`, [rows],
      )
      expect(first.rows[0]).toMatchObject({ inserted_rows: 2, duplicate_rows: 0, error_rows: 2 })
      expect(first.rows[0].error_summary).toContain('rad 3')
      const second = await q<{ inserted_rows: number; duplicate_rows: number }>(
        `select * from import_activities('import_csv', 'f.csv', $1::jsonb)`, [rows],
      )
      expect(second.rows[0]).toMatchObject({ inserted_rows: 0, duplicate_rows: 2 })
      const m = await q<{ distance_m: number }>(`select m.distance_m from activity_metrics m join activities a on a.id = m.activity_id where a.type = 'run'`)
      expect(m.rows).toEqual([{ distance_m: 5000 }])
    })
  })

  it('rejects manual source and oversized imports', async () => {
    expect(await failCode(as(userB, (q) => q(`select import_activities('manual', 'x', '[]'::jsonb)`)))).toBe('22023')
    const big = JSON.stringify(Array.from({ length: 5001 }, () => ({})))
    expect(await failCode(as(userB, (q) => q(`select import_activities('import_json', 'x', $1::jsonb)`, [big])))).toBe('22023')
  })
})
