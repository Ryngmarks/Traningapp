// In-memory stand-in for the Supabase REST/RPC API, used by e2e/smoke.mjs to
// drive the real UI in Playwright without a Supabase project. It implements
// only what the app calls, with realistic seeded data. Business rules that
// matter for safety (RLS, constraints) are tested against real Postgres in
// supabase/tests; this mock is for UI flows and visual checks.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const USER_ID = '7d1c2c2e-3a5f-4c1e-9b7a-0f2d6c1a9e11'
export const FRIEND_ID = '2b0c9f1e-6a77-4d0f-8e1b-5c4d3a2b1f00'

const DAY = 86_400_000

function seedExercises(root) {
  const sql = ['20261027000300_exercise_library.sql', '20261027000700_general_gym_library.sql']
    .map((f) => readFileSync(`${root}/supabase/migrations/${f}`, 'utf8')).join('\n')
  const re = /\('([a-z0-9_]+)', '([^']+)', '([a-z_]+)', '([a-z_]+)',\s*\n\s*'\{([^}]*)\}', '\{([^}]*)\}', '\{([^}]*)\}',\s*\n\s*'([^']*)'\)/g
  const out = []
  for (const m of sql.matchAll(re)) {
    const arr = (s) => (s ? s.split(',') : [])
    out.push({
      id: randomUUID(), owner_id: null, slug: m[1], name: m[2], category: m[3], measurement_type: m[4],
      primary_muscles: arr(m[5]), secondary_muscles: arr(m[6]), equipment: arr(m[7]), instructions: m[8],
      image_path: null, archived_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    })
  }
  // Mirrors migration 20261027000900_cardio_sets.sql.
  for (const e of out) if (['treadmill', 'cross_trainer', 'exercise_bike'].includes(e.slug)) e.measurement_type = 'cardio'
  return out
}

const localDate = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Stockholm' }).format(new Date(iso))

export function createState(root, { now = Date.now(), empty = false } = {}) {
  const exercises = seedExercises(root)
  const bySlug = Object.fromEntries(exercises.map((e) => [e.slug, e]))
  const state = {
    failSets: false,
    latencyMs: 0,
    profile: { id: USER_ID, display_name: 'Johan', timezone: 'Europe/Stockholm', weight_increment_kg: 2.5, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    exercises,
    templates: [],
    activities: [],
    metrics: [],
    performedExercises: [],
    sets: [],
    totals: [],
    imports: [],
    members: [{ user_id: USER_ID, display_name: 'Johan' }, { user_id: FRIEND_ID, display_name: 'Anna' }],
  }
  // A friend's custom exercise (shared with all members).
  exercises.push({ ...exercises.find((e) => e.slug === 'cable_fly'), id: randomUUID(), owner_id: FRIEND_ID, slug: null, name: 'Annas landmine press', category: 'shoulders' })

  const tpl = (name, notes, sort, items, owner = USER_ID) => {
    const t = { id: randomUUID(), user_id: owner, name, notes, sort_order: sort, archived_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
    t.items = items.map(([slug, warm, sets, min, max, dur, rest], i) => ({
      id: randomUUID(), template_id: t.id, user_id: owner, exercise_id: bySlug[slug].id, position: i,
      warmup_sets: warm, planned_sets: sets, rep_min: min, rep_max: max, target_duration_s: dur, target_distance_m: null,
      rest_seconds: rest, notes: null, created_at: t.created_at, updated_at: t.created_at,
    }))
    state.templates.push(t)
    return t
  }
  const a = tpl('Fotbollsstyrka A', 'Ben, explosivitet och ljumske.', 0, [
    ['box_jump', 0, 3, 3, 5, null, 90], ['back_squat', 2, 3, 5, 8, null, 150], ['romanian_deadlift', 1, 3, 6, 10, null, 120],
    ['bulgarian_split_squat', 0, 3, 8, 12, null, 90], ['copenhagen_plank', 0, 3, null, null, 25, 60], ['pallof_press', 0, 3, 10, 12, null, 60],
  ])
  const b = tpl('Fotbollsstyrka B', 'Baksida, höft och bibehållen överkropp.', 1, [
    ['broad_jump', 0, 3, 3, 5, null, 90], ['trap_bar_deadlift', 2, 3, 4, 6, null, 150], ['nordic_hamstring_curl', 0, 3, 4, 6, null, 120],
    ['hip_thrust', 1, 3, 8, 12, null, 90], ['bench_press', 1, 3, 6, 10, null, 120], ['pull_up', 0, 3, 6, 10, null, 120], ['side_plank', 0, 2, null, null, 40, 45],
  ])
  tpl('Helkropp A', 'Allsidigt helkroppspass.', 100, [
    ['back_squat', 2, 3, 6, 10, null, 120], ['bench_press', 1, 3, 6, 10, null, 120], ['barbell_row', 0, 3, 8, 12, null, 90],
    ['overhead_press', 0, 3, 8, 12, null, 90], ['romanian_deadlift', 0, 3, 8, 12, null, 90], ['plank', 0, 3, null, null, 40, 45],
  ], null)
  tpl('Överkropp', 'Bröst, rygg, axlar och armar.', 102, [
    ['bench_press', 1, 4, 6, 10, null, 120], ['seated_cable_row', 0, 3, 8, 12, null, 90], ['db_shoulder_press', 0, 3, 8, 12, null, 90],
    ['pull_up', 0, 3, 6, 10, null, 90], ['db_biceps_curl', 0, 3, 10, 15, null, 60], ['triceps_pushdown', 0, 3, 10, 15, null, 60],
  ], null)
  tpl('Annas axelpass', 'Axlar och armar.', 0, [
    ['db_shoulder_press', 0, 3, 8, 12, null, 90], ['lateral_raise', 0, 3, 12, 15, null, 60], ['face_pull', 0, 3, 12, 15, null, 60],
  ], FRIEND_ID)
  if (empty) {
    state.templates = state.templates.filter((t) => t.user_id !== USER_ID)
    return state
  }

  // ~10 weeks of plausible history.
  const addActivity = (type, startedAt, extra = {}, metrics = null) => {
    const act = {
      id: randomUUID(), user_id: USER_ID, type, status: 'completed', title: null, started_at: startedAt, ended_at: null,
      timezone: 'Europe/Stockholm', local_date: localDate(startedAt), duration_s: 3600, perceived_exertion: null, notes: null,
      template_id: null, template_name: null, source: 'manual', external_id: null, import_id: null,
      created_at: startedAt, updated_at: startedAt, ...extra,
    }
    state.activities.push(act)
    if (metrics) state.metrics.push({ activity_id: act.id, user_id: USER_ID, avg_heart_rate: null, max_heart_rate: null, steps: null, distance_m: null, ...metrics })
    return act
  }
  let progress = 0
  for (let w = 10; w >= 1; w--) {
    const monday = new Date(now - w * 7 * DAY)
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
    monday.setUTCHours(16, 0, 0, 0)
    const at = (d, h = 16) => new Date(monday.getTime() + d * DAY + (h - 16) * 3_600_000).toISOString()
    for (const [day, t] of [[0, a], [3, b]]) {
      if (w === 6 && day === 3) continue // a missed session
      const act = addActivity('gym', at(day, 17), { template_id: t.id, template_name: t.name, duration_s: 3900 + w * 60 })
      t.items.forEach((item, idx) => {
        const ex = state.exercises.find((e) => e.id === item.exercise_id)
        const pe = { id: randomUUID(), activity_id: act.id, user_id: USER_ID, exercise_id: ex.id, exercise_name: ex.name, category: ex.category, measurement_type: ex.measurement_type, position: idx, planned_sets: item.planned_sets, rep_min: item.rep_min, rep_max: item.rep_max, notes: null, created_at: act.started_at, updated_at: act.started_at }
        state.performedExercises.push(pe)
        let pos = 0
        const base = { back_squat: 80, romanian_deadlift: 70, bulgarian_split_squat: 16, pallof_press: 15, trap_bar_deadlift: 110, hip_thrust: 90, bench_press: 75 }[ex.slug]
        for (let s = 0; s < item.warmup_sets; s++) {
          state.sets.push({ id: randomUUID(), performed_exercise_id: pe.id, user_id: USER_ID, position: pos++, kind: 'warmup', weight_kg: base ? Math.round(base * 0.5) : null, reps: 8, duration_s: null, distance_m: null, completed_at: act.started_at, created_at: act.started_at, updated_at: act.started_at })
        }
        for (let s = 0; s < item.planned_sets; s++) {
          const load = base ? base + Math.floor((10 - w) / 3) * 2.5 : ex.measurement_type === 'bodyweight_reps' && ex.slug === 'pull_up' ? 5 : null
          const reps = item.rep_max ? Math.min(item.rep_max, item.rep_min + ((10 - w + s) % (item.rep_max - item.rep_min + 1))) : null
          state.sets.push({ id: randomUUID(), performed_exercise_id: pe.id, user_id: USER_ID, position: pos++, kind: 'working', weight_kg: load, reps, duration_s: item.target_duration_s ? item.target_duration_s + (10 - w) : null, distance_m: null, completed_at: act.started_at, created_at: act.started_at, updated_at: act.started_at })
        }
      })
      progress++
    }
    addActivity('football_training', at(1, 18), { duration_s: 5400, perceived_exertion: 6 })
    addActivity('football_training', at(3, 18), { duration_s: 5400, perceived_exertion: 7 })
    if (w % 1 === 0) addActivity('football_match', at(5, 13), { duration_s: 5400, perceived_exertion: 9, title: 'Seriematch' })
    addActivity('run', at(2, 7), { duration_s: 1680 + w * 10 }, { distance_m: 5000 + (w % 3) * 400 })
    if (w % 2 === 0) addActivity('walk', at(6, 10), { duration_s: 3000 }, { distance_m: 4200, steps: 5600 })
  }
  state.totals.push({
    id: randomUUID(), user_id: USER_ID, activity_type: 'gym', session_count: 110, total_distance_m: null, total_duration_s: null,
    period_start: null, covers_until: localDate(new Date(now - 11 * 7 * DAY).toISOString()), source_label: 'Gymappen', notes: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  })
  return state
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

function parseFilters(url) {
  const filters = []
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
    const m = /^(not\.)?(eq|is|neq|gte|lte)\.(.*)$/.exec(v)
    if (m) filters.push({ col: k, not: Boolean(m[1]), op: m[2], val: m[3] })
  }
  return filters
}

function matches(row, filters) {
  return filters.every(({ col, not, op, val }) => {
    if (col.includes('.')) return true // embedded filters are handled per endpoint
    const v = row[col]
    let ok
    if (op === 'is') ok = val === 'null' ? v == null : String(v) === val
    else if (op === 'eq') ok = String(v) === val
    else if (op === 'neq') ok = String(v) !== val
    else if (op === 'gte') ok = String(v) >= val
    else if (op === 'lte') ok = String(v) <= val
    return not ? !ok : ok
  })
}

function embedWorkout(state, act) {
  return {
    ...act,
    exercises: state.performedExercises.filter((p) => p.activity_id === act.id)
      .map((p) => ({ ...p, sets: state.sets.filter((s) => s.performed_exercise_id === p.id) })),
  }
}

function lastPerformance(state, exerciseId) {
  const candidates = state.performedExercises
    .filter((p) => p.exercise_id === exerciseId)
    .map((p) => ({ p, a: state.activities.find((a) => a.id === p.activity_id) }))
    .filter(({ p, a }) => a && a.status === 'completed' && state.sets.some((s) => s.performed_exercise_id === p.id && s.completed_at))
    .sort((x, y) => y.a.started_at.localeCompare(x.a.started_at))
  return candidates[0] ?? null
}

function addPerformedExercise(state, activityId, exerciseId, position, plan) {
  const ex = state.exercises.find((e) => e.id === exerciseId)
  const pe = { id: randomUUID(), activity_id: activityId, user_id: USER_ID, exercise_id: ex.id, exercise_name: ex.name, category: ex.category, measurement_type: ex.measurement_type, position, planned_sets: plan.planned_sets, rep_min: plan.rep_min ?? null, rep_max: plan.rep_max ?? null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  state.performedExercises.push(pe)
  const last = lastPerformance(state, exerciseId)
  const prev = last ? state.sets.filter((s) => s.performed_exercise_id === last.p.id && s.completed_at).sort((x, y) => x.position - y.position) : []
  const prevOf = (kind, i) => { const l = prev.filter((s) => s.kind === kind); return l[Math.min(i, l.length - 1)] }
  let pos = 0
  for (let i = 0; i < (plan.warmup_sets ?? 0); i++) {
    const p = prevOf('warmup', i)
    state.sets.push({ id: randomUUID(), performed_exercise_id: pe.id, user_id: USER_ID, position: pos++, kind: 'warmup', weight_kg: p?.weight_kg ?? null, reps: p?.reps ?? null, duration_s: p?.duration_s ?? null, distance_m: p?.distance_m ?? null, speed_kmh: p?.speed_kmh ?? null, incline_pct: p?.incline_pct ?? null, calories: p?.calories ?? null, completed_at: null, created_at: pe.created_at, updated_at: pe.created_at })
  }
  for (let i = 0; i < (plan.planned_sets ?? 3); i++) {
    const p = prevOf('working', i)
    state.sets.push({ id: randomUUID(), performed_exercise_id: pe.id, user_id: USER_ID, position: pos++, kind: 'working', weight_kg: p?.weight_kg ?? null, reps: p?.reps ?? (['weight_reps', 'bodyweight_reps'].includes(ex.measurement_type) ? plan.rep_min ?? null : null), duration_s: p?.duration_s ?? plan.target_duration_s ?? null, distance_m: p?.distance_m ?? null, speed_kmh: p?.speed_kmh ?? null, incline_pct: p?.incline_pct ?? null, calories: p?.calories ?? null, completed_at: null, created_at: pe.created_at, updated_at: pe.created_at })
  }
  return pe.id
}

const rpc = {
  start_workout(state, { p_template_id }) {
    if (state.activities.some((a) => a.status === 'in_progress')) {
      return { status: 409, body: { code: '23505', message: 'active_workout_exists', details: null, hint: null } }
    }
    const t = p_template_id ? state.templates.find((x) => x.id === p_template_id) : null
    const ownTemplate = t && t.user_id === USER_ID
    const now = new Date().toISOString()
    const act = { id: randomUUID(), user_id: USER_ID, type: 'gym', status: 'in_progress', title: t?.name ?? null, started_at: now, ended_at: null, timezone: 'Europe/Stockholm', local_date: localDate(now), duration_s: null, perceived_exertion: null, notes: null, template_id: ownTemplate ? t.id : null, template_name: t?.name ?? null, source: 'manual', external_id: null, import_id: null, created_at: now, updated_at: now }
    state.activities.push(act)
    for (const item of t?.items ?? []) addPerformedExercise(state, act.id, item.exercise_id, item.position, item)
    return { body: act.id }
  },
  add_performed_exercise(state, b) {
    return { body: addPerformedExercise(state, b.p_activity_id, b.p_exercise_id, b.p_position, { warmup_sets: b.p_warmup_sets, planned_sets: b.p_planned_sets, rep_min: b.p_rep_min, rep_max: b.p_rep_max }) }
  },
  finish_workout(state, { p_activity_id }) {
    const act = state.activities.find((a) => a.id === p_activity_id && a.status === 'in_progress')
    if (!act) return { status: 404, body: { code: 'P0002', message: 'no active workout with this id' } }
    const peIds = new Set(state.performedExercises.filter((p) => p.activity_id === act.id).map((p) => p.id))
    state.sets = state.sets.filter((s) => !(peIds.has(s.performed_exercise_id) && !s.completed_at))
    state.performedExercises = state.performedExercises.filter((p) => !peIds.has(p.id) || state.sets.some((s) => s.performed_exercise_id === p.id))
    act.status = 'completed'
    act.ended_at = new Date().toISOString()
    act.duration_s = Math.round((Date.parse(act.ended_at) - Date.parse(act.started_at)) / 1000)
    return { status: 204, body: null }
  },
  save_template(state, { p_template_id, p_name, p_notes, p_items }) {
    let t = p_template_id ? state.templates.find((x) => x.id === p_template_id) : null
    if (t && t.user_id !== USER_ID) return { status: 404, body: { code: 'P0002', message: 'template not found' } }
    if (!t) {
      t = { id: randomUUID(), user_id: USER_ID, sort_order: state.templates.length, archived_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), items: [] }
      state.templates.push(t)
    }
    t.name = p_name
    t.notes = p_notes || null
    t.items = p_items.map((i, idx) => ({ id: i.id ?? randomUUID(), template_id: t.id, user_id: USER_ID, position: idx, warmup_sets: 0, planned_sets: 3, rep_min: null, rep_max: null, target_duration_s: null, target_distance_m: null, rest_seconds: null, notes: null, created_at: t.created_at, updated_at: t.created_at, ...i }))
    return { body: t.id }
  },
  last_performances(state, { p_exercise_ids }) {
    const rows = []
    for (const id of p_exercise_ids) {
      const last = lastPerformance(state, id)
      if (!last) continue
      rows.push({
        exercise_id: id, activity_id: last.a.id, started_at: last.a.started_at, rep_min: last.p.rep_min, rep_max: last.p.rep_max,
        sets: state.sets.filter((s) => s.performed_exercise_id === last.p.id && s.completed_at).sort((x, y) => x.position - y.position)
          .map(({ kind, weight_kg, reps, duration_s, distance_m, speed_kmh, incline_pct, calories }) => ({ kind, weight_kg, reps, duration_s, distance_m, speed_kmh, incline_pct, calories })),
      })
    }
    return { body: rows }
  },
  import_activities(state, { p_source, p_file_name, p_rows }) {
    const imp = { id: randomUUID(), user_id: USER_ID, source: p_source, file_name: p_file_name, total_rows: p_rows.length, inserted_rows: 0, duplicate_rows: 0, error_rows: 0, error_summary: null, created_at: new Date().toISOString() }
    for (const r of p_rows) {
      const ext = r.external_id ?? `${r.type}|${r.started_at}`
      if (state.activities.some((a) => a.source === p_source && a.external_id === ext)) { imp.duplicate_rows++; continue }
      const act = { id: randomUUID(), user_id: USER_ID, type: r.type, status: 'completed', title: r.title ?? null, started_at: r.started_at, ended_at: null, timezone: 'Europe/Stockholm', local_date: localDate(r.started_at), duration_s: r.duration_s ?? null, perceived_exertion: r.perceived_exertion ?? null, notes: r.notes ?? null, template_id: null, template_name: null, source: p_source, external_id: ext, import_id: imp.id, created_at: imp.created_at, updated_at: imp.created_at }
      state.activities.push(act)
      if (r.distance_m != null || r.steps != null) state.metrics.push({ activity_id: act.id, user_id: USER_ID, distance_m: r.distance_m ?? null, steps: r.steps ?? null, avg_heart_rate: r.avg_heart_rate ?? null, max_heart_rate: null })
      imp.inserted_rows++
    }
    state.imports.unshift(imp)
    return { body: imp }
  },
}

function metricsFor(state, id) {
  const m = state.metrics.find((x) => x.activity_id === id)
  return m ? { distance_m: m.distance_m, steps: m.steps, avg_heart_rate: m.avg_heart_rate, max_heart_rate: m.max_heart_rate } : null
}

function table(state, name, method, url, body, single) {
  const filters = parseFilters(url)
  const select = url.searchParams.get('select') ?? ''
  const rowsOf = {
    profiles: () => [state.profile],
    exercises: () => state.exercises,
    workout_templates: () => state.templates,
    historical_totals: () => state.totals,
    imports: () => state.imports,
    daily_metrics: () => [],
    activity_metrics: () => state.metrics,
    performed_sets: () => state.sets,
    performed_exercises: () => state.performedExercises,
    activities: () => state.activities,
    members: () => state.members,
  }

  if (method === 'GET') {
    let rows = (rowsOf[name]?.() ?? []).filter((r) => matches(r, filters))
    if (name === 'workout_templates') {
      rows = rows.map((t) => ({ ...t, items: t.items.map((i) => ({ ...i, exercise: (({ id, name: n, category, measurement_type }) => ({ id, name: n, category, measurement_type }))(state.exercises.find((e) => e.id === i.exercise_id)) })) }))
    }
    if (name === 'activities') {
      if (select.includes('performed_exercises')) rows = rows.map((a) => embedWorkout(state, a))
      else if (select.includes('activity_metrics')) rows = rows.map((a) => ({ ...a, metrics: metricsFor(state, a.id) }))
      rows.sort((x, y) => y.started_at.localeCompare(x.started_at))
    }
    if (name === 'performed_sets' && select.includes('performed_exercise')) {
      const raw = url.searchParams.get('performed_exercise.exercise_id') ?? ''
      const exIds = raw.startsWith('in.(') ? raw.slice(4, -1).split(',').map((x) => x.replace(/"/g, '')) : [raw.replace('eq.', '')]
      rows = rows.filter((s) => s.completed_at).map((s) => {
        const pe = state.performedExercises.find((p) => p.id === s.performed_exercise_id)
        const a = pe && state.activities.find((x) => x.id === pe.activity_id)
        return pe && a && exIds.includes(pe.exercise_id) && a.status === 'completed'
          ? { ...s, performed_exercise: { exercise_id: pe.exercise_id, activity: { id: a.id, local_date: a.local_date, status: a.status } } } : null
      }).filter(Boolean)
    }
    if (name === 'performed_exercises' && select.includes('activity')) {
      rows = rows.filter((p) => p.exercise_id && state.activities.find((a) => a.id === p.activity_id)?.status === 'completed')
        .map((p) => ({ exercise_id: p.exercise_id, exercise_name: p.exercise_name, category: p.category, measurement_type: p.measurement_type, created_at: p.created_at, activity: { status: 'completed' } }))
    }
    if (name === 'daily_metrics') rows = []
    return { body: single ? rows[0] ?? null : rows, status: single && !rows[0] ? 406 : 200 }
  }

  const list = rowsOf[name]?.()
  if (method === 'POST') {
    const items = Array.isArray(body) ? body : [body]
    const out = []
    for (const item of items) {
      if (name === 'performed_sets') {
        if (state.failSets) return { status: 0 }
        const i = state.sets.findIndex((s) => s.id === item.id)
        const row = { user_id: USER_ID, created_at: new Date().toISOString(), ...(i >= 0 ? state.sets[i] : {}), ...item, updated_at: new Date().toISOString() }
        if (i >= 0) state.sets[i] = row
        else state.sets.push(row)
        out.push(row)
        continue
      }
      if (name === 'activity_metrics') {
        const i = state.metrics.findIndex((m) => m.activity_id === item.activity_id)
        const row = { user_id: USER_ID, ...(i >= 0 ? state.metrics[i] : {}), ...item }
        if (i >= 0) state.metrics[i] = row
        else state.metrics.push(row)
        out.push(row)
        continue
      }
      const row = { id: randomUUID(), user_id: USER_ID, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...item }
      if (name === 'activities') {
        Object.assign(row, { status: row.status ?? 'completed', local_date: localDate(row.started_at), source: row.source ?? 'manual', template_id: null, template_name: null, external_id: null, import_id: null, ended_at: null })
      }
      if (name === 'exercises') Object.assign(row, { archived_at: null, slug: null, image_path: null })
      if (name === 'historical_totals') Object.assign(row, { source_label: row.source_label ?? null, notes: row.notes ?? null })
      list.push(row)
      out.push(row)
    }
    return { status: 201, body: single ? out[0] : out }
  }
  if (method === 'PATCH') {
    const rows = list.filter((r) => matches(r, filters))
    for (const r of rows) Object.assign(r, body, { updated_at: new Date().toISOString() })
    if (name === 'activities') for (const r of rows) r.local_date = localDate(r.started_at)
    if (name === 'profiles') Object.assign(state.profile, body)
    return { status: 200, body: single ? rows[0] ?? state.profile : rows }
  }
  if (method === 'DELETE') {
    if (name === 'performed_sets' && state.failSets) return { status: 0 }
    const keep = (r) => !matches(r, filters)
    const key = { exercises: 'exercises', workout_templates: 'templates', historical_totals: 'totals', imports: 'imports', activity_metrics: 'metrics', performed_sets: 'sets', performed_exercises: 'performedExercises', activities: 'activities' }[name]
    if (key) state[key] = state[key].filter(keep)
    if (name === 'activities') {
      const ids = new Set(state.activities.map((a) => a.id))
      state.performedExercises = state.performedExercises.filter((p) => ids.has(p.activity_id))
      const pes = new Set(state.performedExercises.map((p) => p.id))
      state.sets = state.sets.filter((s) => pes.has(s.performed_exercise_id))
    }
    if (name === 'performed_exercises') {
      const pes = new Set(state.performedExercises.map((p) => p.id))
      state.sets = state.sets.filter((s) => pes.has(s.performed_exercise_id))
    }
    return { status: 204, body: null }
  }
  return { status: 405, body: { message: 'not supported in mock' } }
}

/** Playwright route handler for https://mock.supabase.test/** */
export function createHandler(state) {
  return async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() })
    if (state.latencyMs) await new Promise((r) => setTimeout(r, state.latencyMs))

    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: cors() })
      if (url.pathname.endsWith('/token')) return route.fulfill({ status: 200, headers: cors(), contentType: 'application/json', body: JSON.stringify(sessionPayload()) })
      return route.fulfill({ status: 200, headers: cors(), contentType: 'application/json', body: JSON.stringify(sessionPayload().user) })
    }

    const single = (req.headers().accept ?? '').includes('vnd.pgrst.object')
    let body = null
    try { body = req.postData() ? JSON.parse(req.postData()) : null } catch { body = null }

    let res
    const rpcMatch = /^\/rest\/v1\/rpc\/(\w+)$/.exec(url.pathname)
    if (rpcMatch) res = rpc[rpcMatch[1]]?.(state, body ?? {}) ?? { status: 404, body: { message: 'unknown rpc' } }
    else {
      const name = url.pathname.replace('/rest/v1/', '')
      res = table(state, name, method, url, body, single)
    }
    if (res.status === 0) return route.abort('internetdisconnected')
    const status = res.status ?? 200
    return route.fulfill({
      status,
      headers: { ...cors(), 'content-range': '0-0/*' },
      contentType: 'application/json',
      body: status === 204 ? '' : JSON.stringify(res.body),
    })
  }
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': 'content-range',
  }
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function sessionPayload() {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 30
  const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'johan@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  return {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp, email: user.email })}.mock`,
    refresh_token: 'mock-refresh',
    token_type: 'bearer',
    expires_in: 3600 * 24 * 30,
    expires_at: exp,
    user,
  }
}
