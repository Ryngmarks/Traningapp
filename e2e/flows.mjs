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
  check(await page.getByText('Träningstips').isVisible(), 'shared templates section is shown')
  check(await page.getByText(/av Anna/).first().isVisible(), 'shared template shows its author')
  check(await page.getByRole('link', { name: 'Redigera Annas axelpass' }).count() === 0, "friend's template has no edit button")
  await shot(page, 'flow-8-train-shared')
  await page.getByText('Annas axelpass').click()
  await page.getByRole('button', { name: 'Kopiera' }).click()
  await page.waitForURL(/\/traning\/mallar\/(?!ny)/)
  await page.waitForTimeout(400)
  check(await page.getByText('Redigera mall').isVisible(), 'a copied template opens in the editor')
  check(state.templates.filter((t) => t.name === 'Annas axelpass' && t.user_id !== null).length === 2, 'copy is stored as own template')

  // Invite link: the new member chooses name and password.
  const invite = await context.newPage()
  await invite.goto(`${BASE}/#type=invite`)
  check(await invite.getByText('Välkommen!').isVisible({ timeout: 5000 }).catch(() => false), 'invite link asks for name and password')
  await shot(invite, 'flow-9-invite')
  await invite.close()
  await context.close()
}
