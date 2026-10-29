// Click-through flows for e2e/smoke.mjs: the gym workout end to end (start,
// one-tap sets, save failure + retry, reload/resume, leave and return,
// finish), quick activity logging and back navigation from every sub-screen.

export async function run({ browser, devices, BASE, root, newPage, shot, check, createState }) {
  const state = createState(root)
  const { context, page } = await newPage(browser, devices['iPhone 13'], state)
  const completedSets = () => state.sets.filter((s) => s.completed_at).length

  // Start a workout from a template.
  await page.goto(`${BASE}/traning`)
  await page.getByRole('button', { name: 'Starta Fotbollsstyrka A' }).click()
  await page.waitForURL('**/traning/pass')
  const squat = page.locator('[aria-label="Knäböj"]').first()
  await squat.waitFor()
  await shot(page, 'flow-1-workout-started')

  // Sets are prefilled from history: completing one is a single tap.
  const box = squat.getByLabel('Din historik för övningen')
  check(await box.waitFor({ timeout: 5000 }).then(() => true, () => false), 'exercise shows PB / Senast / Oftast box')
  check(/PB/i.test(await box.innerText()) && /Senast/i.test(await box.innerText()), 'box lists PB and last weight')
  const before = completedSets()
  await squat.getByRole('button', { name: 'Klarmarkera set 1' }).click()
  await page.waitForTimeout(400)
  check(completedSets() === before + 1, 'one tap completes and saves a prefilled set')
  check(await squat.getByRole('button', { name: 'Ångra set 1' }).isVisible(), 'completed set can be undone')
  await shot(page, 'flow-2-set-done')

  // Save failure is visible and recoverable.
  state.failSets = true
  await squat.getByRole('button', { name: 'Klarmarkera set 2' }).click()
  await page.waitForTimeout(600)
  check(await page.getByText(/inte sparade/i).first().isVisible(), 'unsaved banner appears when saving fails')
  check(completedSets() === before + 1, 'failed save is not stored')
  await shot(page, 'flow-3-save-failed')
  state.failSets = false
  await page.getByRole('button', { name: 'Försök igen' }).first().click()
  await page.waitForTimeout(600)
  check(completedSets() === before + 2, 'retry stores the set')
  check(!(await page.getByText(/inte sparade/i).first().isVisible().catch(() => false)), 'banner disappears after retry')

  // Edit a value then reload: the workout resumes from the server.
  await page.reload()
  await page.locator('[aria-label="Knäböj"]').first().waitFor()
  check(await page.locator('[aria-label="Knäböj"]').first().getByRole('button', { name: 'Ångra set 2' }).isVisible(), 'workout resumes after reload')

  // Leave and come back via the shell pill.
  await page.getByRole('button', { name: /Tillbaka till Träna/ }).click()
  await page.waitForURL('**/traning')
  await page.waitForTimeout(300)
  await shot(page, 'flow-4-left-workout')
  await page.getByRole('button', { name: /Fotbollsstyrka A/ }).last().click()
  await page.waitForURL('**/traning/pass')

  // Finish with unfinished sets: only completed sets are kept.
  await page.getByRole('button', { name: 'Avsluta pass' }).click()
  await page.waitForTimeout(400)
  await shot(page, 'flow-5-finish-sheet')
  await page.getByRole('dialog').getByRole('button', { name: /^Avsluta/ }).click()
  await page.waitForURL(`${BASE}/`)
  const finished = state.activities.find((a) => a.template_name === 'Fotbollsstyrka A' && a.status === 'completed' && a.local_date === state.activities.at(-1)?.local_date)
  check(Boolean(finished) && !state.activities.some((a) => a.status === 'in_progress'), 'workout is finished')
  await shot(page, 'flow-6-after-finish')

  // Quick-log a run.
  await page.goto(`${BASE}/aktivitet/ny?typ=run`)
  await page.getByLabel(/Distans/).fill('5,2')
  await page.getByRole('button', { name: 'Spara' }).last().click()
  await page.waitForTimeout(600)
  const run = state.activities.filter((a) => a.type === 'run').at(-1)
  check(state.metrics.some((m) => m.activity_id === run?.id && m.distance_m === 5200), 'run with 5,2 km is saved')
  await shot(page, 'flow-7-after-run')

  // Back navigation: every sub-screen opened directly (no history) must lead back somewhere.
  const gymId = state.activities.find((a) => a.type === 'gym' && a.status === 'completed').id
  const exerciseId = state.exercises.find((e) => e.slug === 'back_squat').id
  for (const [path, parent] of [
    ['/traning/ovningar', '/traning'], ['/traning/mallar/ny', '/traning'], ['/aktivitet/ny?typ=walk', '/aktivitet'],
    [`/aktivitet/${gymId}`, '/aktivitet'], [`/statistik/ovning/${exerciseId}`, '/statistik'],
    ['/installningar', '/'], ['/installningar/historik', '/installningar'], ['/installningar/import', '/installningar'],
  ]) {
    const fresh = await context.newPage()
    await fresh.goto(`${BASE}${path}`)
    const back = fresh.getByRole('button', { name: /^Tillbaka/ }).first()
    if (!check(await back.isVisible({ timeout: 5000 }).catch(() => false), `back button on ${path}`)) { await fresh.close(); continue }
    await back.click()
    await fresh.waitForTimeout(400)
    check(new URL(fresh.url()).pathname === parent, `back from ${path} goes to ${parent} (got ${new URL(fresh.url()).pathname})`)
    await fresh.close()
  }

  // Sharing: friends' and starter templates are listed under Träningstips,
  // read-only, and can be copied into your own templates.
  await page.goto(`${BASE}/traning`)
  check(await page.getByText('Träningstips').waitFor({ timeout: 5000 }).then(() => true, () => false), 'shared templates section is shown')
  check(await page.getByText(/av Anna/).first().isVisible(), 'shared template shows its author')
  check(await page.getByRole('link', { name: 'Redigera Annas axelpass' }).count() === 0, "friend's template has no edit button")
  await shot(page, 'flow-8-train-shared')
  await page.getByText('Annas axelpass').click()
  await page.getByRole('button', { name: 'Kopiera' }).click()
  await page.waitForURL(/\/traning\/mallar\/(?!ny)/)
  await page.waitForTimeout(400)
  check(await page.getByText('Redigera mall').isVisible(), 'a copied template opens in the editor')
  check(state.templates.filter((t) => t.name === 'Annas axelpass' && t.user_id !== null).length === 2, 'copy is stored as own template')

  // Cardio machine: time, km, km/h, incline and kcal on one set.
  await page.goto(`${BASE}/traning`)
  await page.getByRole('button', { name: 'Fritt pass' }).click()
  await page.waitForURL('**/traning/pass')
  await page.getByRole('button', { name: /Lägg till övning/ }).last().click()
  await page.getByRole('dialog').getByRole('searchbox').or(page.getByRole('dialog').getByRole('textbox')).first().fill('Löpband')
  await page.getByRole('dialog').getByRole('button', { name: /Löpband/ }).first().click()
  const tread = page.locator('[aria-label="Löpband"]').first()
  await tread.waitFor()
  await tread.getByLabel('Tid i minuter, set 1').fill('30')
  await tread.getByLabel('Distans i km, set 1').fill('5,2')
  await tread.getByLabel('Hastighet, set 1').fill('10,5')
  await tread.getByLabel('Lutning, set 1').fill('2')
  await tread.getByLabel('Kalorier, set 1').fill('320')
  await tread.getByRole('button', { name: 'Klarmarkera set 1' }).click()
  await page.waitForTimeout(800)
  const cardioSet = state.sets.find((x) => x.distance_m === 5200)
  check(cardioSet && cardioSet.duration_s === 1800 && cardioSet.speed_kmh === 10.5 && cardioSet.incline_pct === 2 && cardioSet.calories === 320 && cardioSet.completed_at,
    `treadmill set stores time, km, speed, incline and kcal (got ${JSON.stringify(cardioSet)})`)
  check(state.sets.filter((x) => x.performed_exercise_id === cardioSet?.performed_exercise_id).length === 1, 'a cardio exercise starts with one set')
  await shot(page, 'flow-10-treadmill')

  // Create a new exercise from the search: category and measurement come from the name.
  await page.getByRole('button', { name: /Lägg till övning/ }).last().click()
  await page.getByRole('dialog').getByRole('searchbox').or(page.getByRole('dialog').getByRole('textbox')).first().fill('Hackbenböj')
  await page.getByRole('button', { name: /Skapa ”Hackbenböj”/ }).click()
  const form = page.getByRole('dialog', { name: 'Ny övning' })
  check(await form.getByLabel('Kategori').inputValue() === 'legs', 'new exercise is suggested into Ben from its name')
  await shot(page, 'flow-13-create-exercise')
  await form.getByRole('button', { name: 'Skapa övning' }).click()
  await page.locator('[aria-label="Hackbenböj"]').first().waitFor({ timeout: 5000 }).catch(() => {})
  const created = state.exercises.find((x) => x.name === 'Hackbenböj')
  check(created?.category === 'legs' && created?.measurement_type === 'weight_reps', `created exercise stored as Ben, vikt × reps (got ${created?.category}/${created?.measurement_type})`)
  check(await page.locator('[aria-label="Hackbenböj"]').count() > 0, 'created exercise is added to the workout')

  // Forgotten workout: the finish sheet suggests ending after the last set.
  await page.getByRole('button', { name: 'Avsluta pass' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Avsluta$/ }).click()
  await page.waitForURL(`${BASE}/`)
  await page.goto(`${BASE}/traning`)
  await page.getByRole('button', { name: 'Starta Fotbollsstyrka B' }).click()
  await page.waitForURL('**/traning/pass')
  await page.locator('[aria-label="Stående längdhopp"]').first().getByRole('button', { name: 'Klarmarkera set 1' }).click()
  await page.waitForTimeout(600)
  const running = state.activities.find((x) => x.status === 'in_progress')
  const hours = (h) => new Date(Date.now() - h * 3_600_000).toISOString()
  running.started_at = hours(3)
  for (const st of state.sets) if (st.completed_at && Date.parse(st.completed_at) > Date.now() - 60_000) st.completed_at = hours(2)
  await page.reload()
  await page.getByRole('button', { name: 'Avsluta pass' }).click()
  const dialog = page.getByRole('dialog')
  check(await dialog.getByText(/Glömde du avsluta/).waitFor({ timeout: 5000 }).then(() => true, () => false), 'finish sheet notices a forgotten workout')
  await shot(page, 'flow-11-forgotten-finish')
  await dialog.getByRole('button', { name: /^Avsluta$/ }).click()
  await page.waitForURL(`${BASE}/`)
  check(Math.abs(running.duration_s - 65 * 60) < 120, `forgotten workout ends 5 min after the last set (got ${running.duration_s}s)`)

  // Adjust a finished workout's time afterwards.
  await page.goto(`${BASE}/aktivitet/${running.id}`)
  await page.getByRole('button', { name: 'Justera tid' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '75 min' }).click()
  await shot(page, 'flow-12-adjust-time')
  await page.getByRole('dialog').getByRole('button', { name: 'Spara' }).click()
  await page.waitForTimeout(600)
  check(running.duration_s === 4500, `adjusted duration is saved (got ${running.duration_s})`)

  // Invite link: the new member chooses name and password.
  const invite = await context.newPage()
  await invite.goto(`${BASE}/#type=invite`)
  check(await invite.getByText('Välkommen!').isVisible({ timeout: 5000 }).catch(() => false), 'invite link asks for name and password')
  await shot(invite, 'flow-9-invite')
  await invite.close()
  await context.close()
}
