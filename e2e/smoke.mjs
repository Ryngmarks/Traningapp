#!/usr/bin/env node
// Visual + flow smoke test on iPhone and desktop viewports against an
// in-memory mock of the Supabase API (e2e/mock-backend.mjs).
//
//   node e2e/smoke.mjs [--out <dir>] [--skip-build]
//
// Builds the app with a mock Supabase URL into dist-e2e/, serves it with
// `vite preview`, walks the main flows, saves screenshots and fails on any
// console error, page error or failed assertion. Uses the Playwright that is
// installed globally in the dev container (not a project dependency).
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createHandler, createState, sessionPayload } from './mock-backend.mjs'

const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright')

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : `${root}e2e/screenshots`
mkdirSync(outDir, { recursive: true })
const MOCK = 'https://mock.supabase.test'
const PORT = 4179
const BASE = `http://localhost:${PORT}`

if (!args.includes('--skip-build')) {
  execFileSync('npx', ['vite', 'build', '--outDir', 'dist-e2e', '--emptyOutDir'], {
    cwd: root, stdio: 'inherit',
    env: { ...process.env, VITE_SUPABASE_URL: MOCK, VITE_SUPABASE_ANON_KEY: 'mock-anon-key' },
  })
}
const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

const failures = []
const check = (cond, msg) => { if (!cond) failures.push(msg); return cond }

async function newPage(browser, device, state, { signedIn = true } = {}) {
  const context = await browser.newContext({ ...device, serviceWorkers: 'block' })
  await context.route(`${MOCK}/**`, createHandler(state))
  if (signedIn) {
    await context.addInitScript((session) => {
      localStorage.setItem('traningsapp-auth', JSON.stringify(session))
    }, sessionPayload())
  }
  const page = await context.newPage()
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) failures.push(`[console] ${m.text()}`) })
  page.on('pageerror', (e) => failures.push(`[pageerror] ${e.message}`))
  return { context, page }
}

async function shot(page, name) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true })
}

async function noHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(overflow <= 1, `${label}: horizontal overflow ${overflow}px`)
}

const ROUTES = [
  ['overview', '/'],
  ['train', '/traning'],
  ['library', '/traning/ovningar'],
  ['template', '/traning/mallar/ny'],
  ['activity', '/aktivitet'],
  ['activity-new-run', '/aktivitet/ny?typ=run'],
  ['stats', '/statistik'],
  ['settings', '/installningar'],
  ['history', '/installningar/historik'],
  ['import', '/installningar/import'],
]

const browser = await chromium.launch()
try {
  for (const [label, device] of [['iphone', devices['iPhone 13']], ['desktop', { viewport: { width: 1280, height: 860 } }]]) {
    const state = createState(root)
    const { context, page } = await newPage(browser, device, state)
    for (const [name, path] of ROUTES) {
      await page.goto(`${BASE}${path}`)
      await shot(page, `${label}-${name}`)
      await noHorizontalScroll(page, `${label} ${path}`)
    }
    await context.close()
  }

  // Login screen (signed out).
  {
    const { context, page } = await newPage(browser, devices['iPhone 13'], createState(root), { signedIn: false })
    await page.goto(BASE)
    check(await page.getByRole('button', { name: 'Logga in' }).isVisible(), 'login button visible')
    check(await page.getByText(/registrera|skapa konto/i).count() === 0, 'no sign-up offered')
    await shot(page, 'iphone-login')
    await context.close()
  }

  // Brand-new user: empty states.
  {
    const { context, page } = await newPage(browser, devices['iPhone 13'], createState(root, { empty: true }))
    for (const [name, path] of [['overview', '/'], ['activity', '/aktivitet'], ['stats', '/statistik']]) {
      await page.goto(`${BASE}${path}`)
      await shot(page, `iphone-empty-${name}`)
    }
    await context.close()
  }

  const flows = await import('./flows.mjs').catch(() => null)
  if (flows) await flows.run({ browser, devices, BASE, root, newPage, shot, check, createState, noHorizontalScroll })
} finally {
  await browser.close()
  server.kill()
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`OK. Screenshots in ${outDir}`)
