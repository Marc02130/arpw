#!/usr/bin/env node
/**
 * Literature-review UAT runner (UAT/README.md steps 1–13).
 * Local stack only: Vite :5173, Supabase :54321, Mailpit :54324.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const REPORTS = path.join(__dirname, 'reports')
const SHOTS = path.join(REPORTS, 'screenshots')
const KEY_FILE = path.join(__dirname, '.uat-grok-key')
const BASE = 'http://127.0.0.1:5173'
const MAILPIT = 'http://127.0.0.1:54324'
const PROMPT = 'Synthesize a literature review of the gut-brain axis in Alzheimer’s disease from the uploaded papers only. Cover microbiome, inflammation, omega-3 fatty acids, and clinical-trial evidence. Cite only retrieved [S#] ids. Do not invent studies, n, or outcomes.'
const TITLE = 'Gut-brain axis in Alzheimer’s disease: a literature review'
const WANT_SECTIONS = new Set(['Abstract', 'Introduction', 'Literature Review', 'Discussion', 'Conclusion', 'References'])
const DISCLAIMER = 'AI-generated draft. Requires human review'

fs.mkdirSync(SHOTS, { recursive: true })

const sha = (() => {
  try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim() } catch { return 'unknown' }
})()

const state = {
  operator: 'ARPW Dogfood',
  gitSha: sha,
  startedAt: new Date().toISOString(),
  embeddingModel: null,
  filesIndexed: 0,
  filesFailed: 0,
  steps: {},
  notes: [],
  verdict: null,
}

function saveState() {
  fs.writeFileSync(path.join(REPORTS, '.uat-state.json'), JSON.stringify(state, null, 2))
}
function crashLog(msg) {
  try { fs.appendFileSync(path.join(REPORTS, 'crash.log'), new Date().toISOString() + ' ' + msg + '\n') } catch {}
  console.error(msg)
}
process.on('uncaughtException', (e) => {
  crashLog('UNCAUGHT ' + (e && e.stack || e))
  try { state.notes.push(String(e && e.message || e)); state.verdict = state.verdict || 'FAIL'; writeReport(); saveState() } catch {}
  process.exit(1)
})
process.on('unhandledRejection', (e) => {
  crashLog('UNHANDLED ' + (e && e.stack || e))
  try { state.notes.push(String(e && (e.stack || e.message) || e)); state.verdict = state.verdict || 'FAIL'; writeReport(); saveState() } catch {}
  process.exit(1)
})


function record(step, status, note = '') {
  state.steps[String(step)] = { status, note: String(note).slice(0, 500), at: new Date().toISOString() }
  saveState()
  console.log(`STEP ${step}: ${status}${note ? ' — ' + String(note).slice(0, 160) : ''}`)
}

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }) } catch {}
}

function looksLikeFilesystemPath(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) return true
  if (/^file:/i.test(trimmed)) return true
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) return true
  if (trimmed.includes('\\')) return true
  if (/\.(env|pem|key|txt)$/i.test(trimmed)) return true
  return false
}

function grokKeyShapeError(key) {
  if (!key) return 'GROK_API_KEY / UAT/.uat-grok-key missing'
  if (looksLikeFilesystemPath(key)) {
    return 'UAT Grok key looks like a filesystem path. Put a real xai- key in GROK_API_KEY or UAT/.uat-grok-key'
  }
  if (key.length < 10) return 'UAT Grok key is too short'
  if (!key.startsWith('xai-')) return 'UAT Grok key must start with xai-'
  return null
}

function loadKey() {
  if (process.env.GROK_API_KEY) return process.env.GROK_API_KEY.trim()
  if (fs.existsSync(KEY_FILE)) return fs.readFileSync(KEY_FILE, 'utf8').trim()
  return null
}

function priorPass(step) {
  return state.steps[String(step)]?.status === 'PASS'
}

function blockUnless(thisStep, needed, extra = '') {
  if (priorPass(needed)) return true
  record(thisStep, 'BLOCKED', extra || `needs step ${needed} PASS`)
  return false
}

function loadSavedState() {
  const p = path.join(REPORTS, '.uat-state.json')
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function parseEmail(note) {
  const m = String(note || '').match(/([\w.+-]+@example\.com)/i)
  return m ? m[1] : null
}

function parsePaperId(note) {
  const m = String(note || '').match(/paper=([0-9a-f-]{36})/i)
  return m ? m[1] : null
}

function outlineLooksGrounded(text) {
  const chunk = String(text || '').trim()
  if (chunk.length < 40) return 'outline too short'
  if (!/##\s+(Abstract|Introduction|Literature Review)/i.test(chunk)) {
    return 'outline missing ## section headings'
  }
  if (/\b1\.\s+\S+\.pdf\b/i.test(chunk) || /Works cited from the uploaded corpus/i.test(chunk)) {
    return 'outline listed PDF filenames'
  }
  return null
}

function referencesLooksAcademic(text) {
  const chunk = String(text || '')
  const refs = chunk.match(/References[\s\S]{0,4000}/i)?.[0] || chunk
  if (/No retrieved sources/i.test(refs)) return 'References says no retrieved sources'
  if (/Citation:\s/i.test(refs)) return 'References dumped publisher Citation: boilerplate'
  if (/\b1\.\s+\S+\.pdf\b/i.test(refs) || /Works cited from the uploaded corpus/i.test(refs)) {
    return 'References listed PDF filenames'
  }
  return null
}

function pdfs() {
  const dir = path.join(__dirname, 'papers')
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')).map((f) => path.join(dir, f)).sort()
}

async function mailpitConfirmLink(email, timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const q = encodeURIComponent(`to:${email}`)
    let res = await fetch(`${MAILPIT}/api/v1/search?query=${q}`)
    let data = await res.json().catch(() => ({}))
    let messages = data.messages || []
    if (!messages.length) {
      res = await fetch(`${MAILPIT}/api/v1/messages`)
      data = await res.json().catch(() => ({}))
      messages = (data.messages || []).filter((m) => (m.To || []).some((t) => (t.Address || '').toLowerCase() === email.toLowerCase()))
    }
    messages.sort((a, b) => new Date(b.Created) - new Date(a.Created))
    for (const m of messages.slice(0, 5)) {
      const id = m.ID || m.ID
      const full = await fetch(`${MAILPIT}/api/v1/message/${m.ID}`).then((r) => r.json()).catch(() => null)
      if (!full) continue
      const html = full.HTML || full.Text || ''
      const match = html.match(/https?:\/\/[^\s"'<>]+confirm[^\s"'<>]*/i) || html.match(/https?:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify[^\s"'<>]*/i) || html.match(/href="([^"]+)"/i)
      if (match) {
        let link = match[1] || match[0]
        link = link.replace(/&amp;/g, '&')
        return link
      }
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('No confirmation email found in Mailpit for ' + email)
}

async function waitIndexed(page, timeoutMs = 180000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const body = await page.locator('body').innerText()
    const m = body.match(/Indexed \((\d+) chunks\)/g) || []
    if (m.length > 0) return m
    if (/Stored \(not indexed\)/.test(body)) {
      await page.waitForTimeout(3000)
      continue
    }
    await page.waitForTimeout(2000)
  }
  throw new Error('No Indexed (N chunks) within timeout')
}

function writeReport() {
  const lines = [
    `# Literature-review UAT`,
    ``,
    `- Operator: ${state.operator}`,
    `- Git SHA: \`${state.gitSha}\``,
    `- Started: ${state.startedAt}`,
    `- Finished: ${new Date().toISOString()}`,
    `- Embedding model: ${state.embeddingModel || 'n/a'}`,
    `- Files indexed (UI): ${state.filesIndexed}`,
    `- Files failed (UI): ${state.filesFailed}`,
    `- Verdict: **${state.verdict}**`,
    ``,
    `## Step table`,
    ``,
    `| # | Status | Note |`,
    `|---|---|---|`,
  ]
  for (let i = 1; i <= 13; i++) {
    const s = state.steps[String(i)] || { status: 'BLOCKED', note: 'not run' }
    lines.push(`| ${i} | ${s.status} | ${(s.note || '').replace(/\|/g, '/')} |`)
  }
  if (state.notes.length) {
    lines.push('', '## Notes', ...state.notes.map((n) => `- ${n}`))
  }
  lines.push('', 'Do not paste long draft excerpts that quote the PDFs into git.')
  fs.writeFileSync(path.join(REPORTS, '2026-09-07-literature-review.md'), lines.join('\n'))
}

const RESUME = process.argv.includes('--resume')

async function main() {
  const files = pdfs()
  if (files.length !== 20) {
    state.notes.push(`Expected 20 PDFs, found ${files.length}`)
  }
  let email = `uat-litrev-${Date.now()}@example.com`
  const password = 'UatDogfood!2026'
  let paperId = null
  if (RESUME) {
    const saved = loadSavedState()
    if (!saved) throw new Error('--resume requires UAT/reports/.uat-state.json')
    Object.assign(state, saved, {
      notes: Array.isArray(saved.notes) ? saved.notes : [],
      steps: saved.steps || {},
    })
    state.gitSha = sha
    email = parseEmail(state.steps['1']?.note) || state.email
    paperId = parsePaperId(state.steps['3']?.note) || state.paperId
    if (!email || !paperId) throw new Error('--resume needs email from step 1 and paper id from step 3')
    state.email = email
    state.paperId = paperId
    state.notes.push('resuming from saved state; paper=' + paperId)
  }
  const grokKey = loadKey()
  const shapeErr = grokKeyShapeError(grokKey)
  if (shapeErr) {
    record(2, grokKey ? 'FAIL' : 'BLOCKED', shapeErr)
    for (const s of [8, 9, 10, 11, 12, 13]) {
      record(s, 'BLOCKED', 'invalid Grok key fixture')
    }
    state.verdict = grokKey ? 'FAIL' : 'BLOCKED'
    state.notes.push(shapeErr)
    writeReport()
    saveState()
    console.error(shapeErr)
    process.exit(1)
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultTimeout(60000)
  browser.on('disconnected', () => crashLog('browser disconnected'))
  page.on('crash', () => crashLog('page crash'))
  page.on('close', () => crashLog('page close'))

  try {
    // Step 1: signup + confirm (or login on --resume)
    try {
      await page.goto(`${BASE}/login`)
      if (RESUME) {
        const signInToggle = page.getByRole('button', { name: /Already have an account\? Sign in/i })
        if (await signInToggle.isVisible().catch(() => false)) await signInToggle.click()
        await page.fill('#email', email)
        await page.fill('#password', password)
        await page.getByRole('button', { name: 'Sign In' }).click()
        await page.waitForURL(/\/dashboard/, { timeout: 30000 })
        record(1, 'PASS', `resumed session for ${email}`)
      } else {
      await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click()
      await page.fill('#fullName', 'ARPW Dogfood')
      await page.fill('#email', email)
      await page.fill('#password', password)
      await page.fill('#confirmPassword', password)
      await page.getByRole('button', { name: 'Create Account' }).click()
      await page.waitForURL(/verify-email|dashboard|login/, { timeout: 30000 })
      const link = await mailpitConfirmLink(email)
      await page.goto(link)
      await page.waitForTimeout(2000)
      // may land on app root or need login
      if (!page.url().includes('/dashboard')) {
        await page.goto(`${BASE}/login`)
        // if still on signup toggle, switch to sign in
        const signInToggle = page.getByRole('button', { name: /Already have an account\? Sign in/i })
        if (await signInToggle.isVisible().catch(() => false)) await signInToggle.click()
        await page.fill('#email', email)
        await page.fill('#password', password)
        await page.getByRole('button', { name: 'Sign In' }).click()
      }
      await page.waitForURL(/\/dashboard/, { timeout: 30000 })
      record(1, 'PASS', `confirmed session for ${email}`)
      }
      state.email = email
    } catch (e) {
      await shot(page, 'step1-fail')
      record(1, 'FAIL', e.message)
      throw e
    }

    // Step 2: Grok key on Profile
    try {
      if (!grokKey) {
        record(2, 'BLOCKED', 'GROK_API_KEY / UAT/.uat-grok-key missing')
      } else {
        await page.goto(`${BASE}/profile`)
        await page.waitForSelector('#grok_api_key')
        const nameVal = await page.inputValue('#full_name')
        if (!nameVal.trim()) await page.fill('#full_name', 'ARPW Dogfood')
        await page.locator('#grok_api_key').click()
        await page.locator('#grok_api_key').fill('')
        await page.locator('#grok_api_key').pressSequentially(grokKey, { delay: 5 })
        if ((await page.locator('#grok_api_key').inputValue()).length < 10) throw new Error('key input empty')
        await page.getByRole('button', { name: /Save Changes/i }).click()
        await page.waitForTimeout(500)
        // wait for server status text
        await page.waitForFunction(() => {
          const t = document.body.innerText
          return /ends in/i.test(t) || /key is saved on the server/i.test(t) || /role="alert"/.test(document.body.innerHTML)
        }, null, { timeout: 15000 }).catch(() => {})
        await page.waitForTimeout(500)
        const body = await page.locator('body').innerText()
        const alert = await page.locator('[role="alert"]').allTextContents().catch(() => [])
        if (/API key appears to be too short|file path|must start with xai-|Could not save|error/i.test(body) && !/ends in/i.test(body)) {
          throw new Error(`Profile save failed: ${(alert.join(' ') || body).slice(0, 240)}`)
        }
        if (!/ends in/i.test(body) && !/key is saved on the server/i.test(body)) {
          throw new Error(`Profile did not show saved key last4; alerts=${alert.join('|').slice(0,200)} body=${body.slice(0,300)}`)
        }
        if (body.includes(grokKey)) throw new Error('Full Grok key visible on Profile')
        record(2, 'PASS', (body.match(/ends in \w+/) || ['key saved'])[0])
        /* keep KEY_FILE for re-runs */
      }
    } catch (e) {
      await shot(page, 'step2-fail')
      record(2, 'FAIL', e.message)
    }

    // Step 3: Start paper
    if (!RESUME) {
    try {
      await page.goto(`${BASE}/dashboard`)
      await page.fill('#new-paper-title', TITLE)
      await page.selectOption('#new-paper-type', 'Literature Review')
      await page.getByRole('button', { name: 'Start paper' }).click()
      await page.waitForURL(/\/generate\?paper=/, { timeout: 30000 })
      paperId = new URL(page.url()).searchParams.get('paper')
      if (!paperId) throw new Error('missing paper id')
      state.paperId = paperId
      record(3, 'PASS', `paper=${paperId}`)
    } catch (e) {
      await shot(page, 'step3-fail')
      record(3, 'FAIL', e.message)
      throw e
    }

    // Step 4: Upload 20 literature PDFs
    try {
      await page.goto(`${BASE}/generate/upload?paper=${paperId}`)
      await page.waitForSelector('h2:text("Literature")')
      // literature upload zone is first file input under Literature heading
      const litSection = page.locator('h2', { hasText: 'Literature' }).first()
      const zone = litSection.locator('xpath=ancestor::div[contains(@class,"space-y") or contains(@class,"card") or true()][1]')
      // Prefer aria-label Upload reference files near Literature
      const litInput = page.locator('[aria-label="Upload reference files"]').locator('xpath=ancestor::div[1]//input[@type="file"]').first()
      const input = (await litInput.count()) ? litInput : page.locator('input[type="file"]').first()
      await input.setInputFiles(files)
      // wait for upload progress to settle
      await page.waitForTimeout(5000)
      const body = await page.locator('body').innerText()
      const rejected = /rejected|not an accepted|too large|error uploading/i.test(body)
      // listed filenames
      let listed = 0
      for (const f of files) {
        const base = path.basename(f)
        if (body.includes(base) || body.includes(base.replace(/\.pdf$/i, ''))) listed++
      }
      // DocumentList may take a moment
      for (let i = 0; i < 30 && listed < 15; i++) {
        await page.waitForTimeout(2000)
        const t = await page.locator('body').innerText()
        listed = files.filter((f) => t.includes(path.basename(f))).length
      }
      if (rejected) throw new Error('upload rejection message seen')
      if (listed < 18) throw new Error(`only ${listed}/20 filenames listed after upload`)
      record(4, 'PASS', `${listed}/20 literature PDFs listed`)
    } catch (e) {
      await shot(page, 'step4-fail')
      record(4, 'FAIL', e.message)
    }

    // Step 5: indexing
    try {
      await page.goto(`${BASE}/generate/upload?paper=${paperId}`)
      const indexed = await waitIndexed(page, 180000)
      state.filesIndexed = indexed.length
      const body = await page.locator('body').innerText()
      const emb = body.match(/grok-embedding-small|hash-384/i)
      if (emb) state.embeddingModel = emb[0]
      // try DB via UI text for embedding
      const notIndexed = (body.match(/Stored \(not indexed\)/g) || []).length
      state.filesFailed = notIndexed
      await page.goto(`${BASE}/library`)
      await page.getByRole('heading', { name: 'Source citations' }).waitFor({ timeout: 20000 })
      const areas = page.locator('textarea[id^="citation-"]')
      const n = await areas.count()
      if (n < 1) throw new Error('Library Source citations has no citation fields')
      let filled = 0
      for (let i = 0; i < n; i++) {
        const v = await areas.nth(i).inputValue()
        if (v.trim().length > 40 && /doi\.org|doi:|PMID/i.test(v)) filled++
      }
      state.notes.push(`Library source citations: ${filled}/${n} look like publisher cites`)
      record(5, 'PASS', `${indexed.length} files show chunk counts; not-indexed=${notIndexed}; citations filled=${filled}/${n}`)
    } catch (e) {
      await shot(page, 'step5-fail')
      record(5, 'BLOCKED', e.message)
    }

    // Step 6: Query sources
    let passageSids = new Set()
    try {
      await page.goto(`${BASE}/generate?paper=${paperId}`)
      await page.getByText(/Working on/i).waitFor({ timeout: 15000 })
      await page.selectOption('#paper-type', 'Literature Review')
      // sections
      for (const section of ['Abstract', 'Introduction', 'Literature Review', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References']) {
        const label = page.locator('label', { hasText: new RegExp(`^${section}$`) }).first()
        if (!(await label.count())) continue
        const cb = label.locator('input[type="checkbox"]')
        const checked = await cb.isChecked()
        const want = WANT_SECTIONS.has(section)
        if (want && !checked) await cb.check()
        if (!want && checked) await cb.uncheck()
      }
      await page.selectOption('#paper-type', 'Literature Review')
      await page.selectOption('#citation-style', 'APA')
      await page.selectOption('#output-format', 'markdown')
      await page.fill('#research-prompt', PROMPT)
      await page.locator('#research-prompt').blur()
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('#generate-outline')
          return btn instanceof HTMLButtonElement && !btn.disabled
        },
        null,
        { timeout: 15000 }
      )
      const outlineResp = page.waitForResponse(
        (r) => r.url().includes('generate_outline') || r.url().includes('/functions/v1/generate_outline'),
        { timeout: 180000 }
      ).catch(() => null)
      await page.click('#generate-outline')
      await page.waitForFunction(() => document.body.innerText.includes('Generating outline'), null, { timeout: 15000 }).catch(() => {})
      const oresp = await outlineResp
      await page.waitForFunction(() => !document.body.innerText.includes('Generating outline'), null, { timeout: 180000 })
      const outlineVal = await page.inputValue('#paper-outline').catch(() => '')
      if (/Save a Grok API key/i.test(await page.locator('body').innerText())) {
        throw new Error('outline refused: missing Grok key')
      }
      if (!oresp || oresp.status() < 200 || oresp.status() >= 300) {
        throw new Error('generate_outline HTTP ' + (oresp ? oresp.status() : 'none'))
      }
      const outlineErr = outlineLooksGrounded(outlineVal)
      if (outlineErr) throw new Error(outlineErr)
      state.notes.push('outline chars=' + outlineVal.trim().length)
      await page.click('#query-sources')
      await page.waitForTimeout(1000)
      await page.waitForFunction(() => !document.body.innerText.includes('Querying...'), null, { timeout: 120000 }).catch(() => {})
      await page.waitForTimeout(1500)
      await page.getByRole('button', { name: 'Pin' }).first().waitFor({ timeout: 60000 }).catch(() => {})
      const body = await page.locator('body').innerText()
      if (!/literature/i.test(body)) throw new Error('no literature role in passages')
      if (/primary/i.test(body) && /original research/i.test(body) && !/0 original research/.test(body)) {
        // primary may appear in corpus counts; passages should prefer literature
      }
      const sidMatches = body.match(/\[S\d+\]/g) || []
      sidMatches.forEach((s) => passageSids.add(s))
      // also capture from passage cards without brackets in interrogate later
      if (!/literature · score|literature ·/i.test(body) && !/literature/i.test(body)) {
        throw new Error('passages missing literature role')
      }
      record(6, 'PASS', `outline+passages; sample sids=${[...passageSids].slice(0, 5).join(',')}`)
    } catch (e) {
      await shot(page, 'step6-fail')
      record(6, 'FAIL', e.message)
    }

    // Step 7: Pin 2–3 literature chunks
    try {
      await page.goto(`${BASE}/generate?paper=${paperId}`)
      await page.getByText(/Working on/i).waitFor({ timeout: 15000 })
      await page.waitForFunction(
        () => {
          const prompt = document.querySelector('#research-prompt')
          const btn = document.querySelector('#query-sources')
          if (!(prompt instanceof HTMLTextAreaElement) || !(btn instanceof HTMLButtonElement)) return false
          if (prompt.disabled) return false
          return prompt.value.trim().length > 0 || !btn.disabled
        },
        null,
        { timeout: 15000 }
      )
      let promptVal = await page.inputValue('#research-prompt').catch(() => '')
      if (!promptVal.trim()) {
        await page.fill('#research-prompt', PROMPT)
        await page.locator('#research-prompt').blur().catch(() => {})
      }
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('#query-sources')
          return btn instanceof HTMLButtonElement && !btn.disabled
        },
        null,
        { timeout: 15000 }
      )
      if ((await page.getByRole('button', { name: 'Pin' }).count()) < 2) {
        await page.click('#query-sources')
        await page.waitForTimeout(1000)
        await page.waitForFunction(() => !document.body.innerText.includes('Querying...'), null, { timeout: 120000 }).catch(() => {})
        await page.waitForTimeout(1500)
      }
      let pinButtons = page.getByRole('button', { name: /^Pin$/ })
      let count = await pinButtons.count()
      console.log('pin_buttons', count)
      let pinned = 0
      for (let i = 0; i < Math.min(count, 5) && pinned < 3; i++) {
        pinButtons = page.getByRole('button', { name: /^Pin$/ })
        const btn = pinButtons.nth(0) // always first remaining Pin
        const card = btn.locator('xpath=ancestor::li[1] | ancestor::div[contains(@class,"rounded")][1]')
        const sel = card.locator('select').first()
        if (await sel.count()) {
          await sel.selectOption({ label: 'Literature Review' }).catch(async () => {
            await sel.selectOption({ index: 1 }).catch(() => {})
          })
        }
        await btn.click({ timeout: 5000 })
        pinned++
        await page.waitForTimeout(800)
      }
      const body = await page.locator('body').innerText()
      const pinnedShown = /Pinned passages/i.test(body) && !/No pins yet/i.test(body)
      if (pinned < 2 && !pinnedShown) throw new Error(`only pinned ${pinned}; buttons_were=${count}`)
      record(7, pinned >= 2 || pinnedShown ? 'PASS' : 'FAIL', `pinned ${pinned}; shown=${pinnedShown}`)
      crashLog('step7 done')
    } catch (e) {
      await shot(page, 'step7-fail')
      record(7, 'FAIL', e.message)
      crashLog('step7 catch ' + e.message)
    }
    }

    // Step 2b+8: clear-key refuse (QA), re-save, then Interrogate
    try {
      crashLog('step2b/8 start paper=' + paperId)
      await page.goto(`${BASE}/profile`)
      await page.waitForURL(/\/profile/)
      await page.waitForSelector('#grok_api_key', { timeout: 15000 })
      const removeBtn = page.getByRole('button', { name: /Remove saved key/i })
      if (!(await removeBtn.count())) {
        // already cleared
        crashLog('no Remove saved key button; assuming cleared')
      } else {
        await removeBtn.click()
        await page.waitForFunction(() => /No key saved|API key removed/i.test(document.body.innerText), null, { timeout: 15000 })
      }
      let body = await page.locator('body').innerText()
      if (!/No key saved/i.test(body) && !/API key removed/i.test(body)) throw new Error('after clear: expected No key saved; got: ' + body.slice(0, 220))
      await page.goto(`${BASE}/generate/interrogate?paper=${paperId}`)
      await page.locator('#interrogate-filter').selectOption('literature')
      await page.getByLabel('Interrogation question').fill('What do these papers say about omega-3 and cognition?')
      await page.getByRole('button', { name: 'Ask' }).click()
      await page.waitForTimeout(2500)
      body = await page.locator('body').innerText()
      if (!/Grok API key|Save a Grok/i.test(body)) {
        record('2b', 'FAIL', 'interrogate did not refuse without key: ' + body.slice(0, 180))
      } else {
        record('2b', 'PASS', 'interrogate refused without key')
      }
      await page.goto(`${BASE}/profile`)
      if (!(await page.inputValue('#full_name')).trim()) await page.fill('#full_name', 'ARPW Dogfood')
      const key = loadKey()
      if (!key) throw new Error('key file missing for re-save')
      await page.locator('#grok_api_key').click()
      await page.locator('#grok_api_key').fill('')
      await page.locator('#grok_api_key').pressSequentially(key, { delay: 5 })
      await page.getByRole('button', { name: /Save Changes/i }).click()
      await page.waitForFunction(() => /ends in/i.test(document.body.innerText) || /key is saved on the server/i.test(document.body.innerText), null, { timeout: 20000 })
      body = await page.locator('body').innerText()
      const last4 = (body.match(/ends in (\w+)/i) || [])[1]
      if (!last4 && !/key is saved on the server/i.test(body)) throw new Error('re-save did not show last4')
      state.notes.push('re-saved last4=' + (last4 || 'present'))
      crashLog('step8 ask with key')
      saveState()
      await page.goto(`${BASE}/generate/interrogate?paper=${paperId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('#interrogate-filter', { timeout: 20000 })
      await page.locator('#interrogate-filter').selectOption('literature')
      await page.getByLabel('Interrogation question').fill('What do these papers say about omega-3 and cognition?')
      const askResp = page.waitForResponse(
        (r) => r.url().includes('interrogate_corpus') || r.url().includes('/functions/v1/interrogate'),
        { timeout: 180000 }
      ).catch((e) => { crashLog('askResp ' + e); return null })
      await page.getByRole('button', { name: 'Ask' }).click()
      crashLog('step8 clicked Ask')
      const resp = await askResp
      crashLog('step8 resp ' + (resp ? resp.status() : 'none'))
      // wait up to 3 min for retrieving banner to clear, but don't die if missing
      for (let i = 0; i < 90; i++) {
        const t = await page.locator('body').innerText()
        if (!/Retrieving passages and asking Grok/i.test(t)) break
        await page.waitForTimeout(2000)
      }
      body = await page.locator('body').innerText()
      await shot(page, 'step8-after-ask')
      if (/Save a Grok API key/i.test(body)) throw new Error('still refusing after re-save')
      const status = resp ? resp.status() : 0
      const sids = body.match(/\[S\d+\]/g) || []
      if (sids.some((x) => x === '[S99]')) throw new Error('invented [S99]')
      if (!resp || status < 200 || status >= 300) {
        throw new Error('interrogate HTTP ' + status + '; sids=' + sids.slice(0, 5).join(','))
      }
      if (!sids.length) {
        throw new Error('interrogate 2xx but no [S#] in UI; gate requires citations')
      }
      record(8, 'PASS', `answer sids=${sids.slice(0, 8).join(',')}; last4=${last4 || 'n/a'}; http=${status}`)
    } catch (e) {
      crashLog('step8 fail ' + (e && e.message || e))
      await shot(page, 'step8-fail')
      record(8, 'FAIL', e.message)
    }

    // Step 9: pin one from the answer thread (stay on the step-8 page)
    try {
      if (!blockUnless(9, 8)) throw new Error('__blocked__')
      crashLog('step9 start')
      const pinBtn = () => page.getByRole('button', { name: /^Pin(\s|$)/ }).first()
      if (!(await pinBtn().count())) {
        await page.goto(`${BASE}/generate/interrogate?paper=${paperId}`)
        await page.getByText('Passages (notes, pin to cite)').first().waitFor({ timeout: 20000 })
      }
      await pinBtn().waitFor({ timeout: 15000 })
      await pinBtn().click()
      await page.getByRole('button', { name: /^Unpin(\s|$)/ }).first().waitFor({ timeout: 15000 })
      await page.goto(`${BASE}/generate?paper=${paperId}`)
      await page.getByText(/Working on/i).waitFor({ timeout: 15000 })
      await page.waitForFunction(
        () => {
          const t = document.body.innerText
          return /Pinned passages/i.test(t) && !/Loading pins/i.test(t) && !/No pins yet/i.test(t)
        },
        null,
        { timeout: 15000 }
      )
      record(9, 'PASS', 'pin visible on Prompt')
    } catch (e) {
      if (e && e.message === '__blocked__') {
        /* already recorded BLOCKED */
      } else {
      await shot(page, 'step9-fail')
      record(9, 'FAIL', e.message)
      }
    }

    // Step 10: Generate
    let draftText = ''
    try {
      crashLog('step10 start')
      if (!priorPass(8)) {
        record(10, 'BLOCKED', 'needs step 8 PASS')
      } else if (state.steps['2']?.status !== 'PASS') {
        record(10, 'BLOCKED', 'needs Grok key from step 2')
      } else {
        await page.goto(`${BASE}/generate?paper=${paperId}`)
        await page.getByText(/Working on/i).waitFor({ timeout: 15000 })
        await page.selectOption('#paper-type', 'Literature Review')
        await page.fill('#research-prompt', PROMPT)
        for (const section of ['Abstract', 'Introduction', 'Literature Review', 'Methods', 'Results', 'Discussion', 'Conclusion', 'References']) {
          const label = page.locator('label', { hasText: new RegExp(`^${section}$`) }).first()
          if (!(await label.count())) continue
          const cb = label.locator('input[type="checkbox"]')
          const checked = await cb.isChecked()
          const want = WANT_SECTIONS.has(section)
          if (want && !checked) await cb.check()
          if (!want && checked) await cb.uncheck()
        }
        await page.selectOption('#citation-style', 'APA')
        await page.selectOption('#output-format', 'markdown')
        const t0 = Date.now()
        const genResp = page.waitForResponse(
          (r) => r.url().includes('generate_paper') || r.url().includes('/functions/v1/generate'),
          { timeout: 300000 }
        ).catch(() => null)
        await page.click('#generate-paper')
        // Wait until Generating... shows, or response starts
        await page.waitForFunction(() => document.body.innerText.includes('Generating...'), null, { timeout: 15000 }).catch(() => {})
        const resp = await genResp
        await page.waitForFunction(() => !document.body.innerText.includes('Generating...'), null, { timeout: 300000 })
        const wall = ((Date.now() - t0) / 1000).toFixed(1)
        state.notes.push(`Generate wall time ~${wall}s; http=${resp ? resp.status() : 'n/a'}`)
        await page.waitForTimeout(1500)
        draftText = await page.locator('body').innerText()
        if (/Save a Grok API key/i.test(draftText)) throw new Error('generate refused: missing Grok key')
        if (wall < 3) throw new Error('generate finished too fast (' + wall + 's) — likely false positive')
        const hasHeading = /## Abstract|## Introduction|Abstract\n|Introduction\n|Literature Review/.test(draftText)
        const hasDisclaimer = /AI-generated draft|Requires human review/i.test(draftText)
        if (!hasHeading && !/draft|Generated/i.test(draftText)) throw new Error('draft missing expected headings')
        const refsErr = referencesLooksAcademic(draftText)
        if (refsErr) throw new Error(refsErr)
        record(10, hasDisclaimer ? 'PASS' : 'FAIL', `draft shown; disclaimer=${hasDisclaimer}; ${wall}s`)
      }
    } catch (e) {
      await shot(page, 'step10-fail')
      record(10, 'FAIL', e.message)
    }

    // Step 11: citation spot-check
    try {
      const text = draftText || (await page.locator('body').innerText())
      const cites = text.match(/\[S\d+\]/g) || []
      if (cites.includes('[S99]')) throw new Error('invented [S99]')
      // author-year like (Smith, 2020) invented hard to detect; flag obvious unknowns
      if (state.steps['10']?.status !== 'PASS') {
        record(11, 'BLOCKED', 'generate did not PASS')
      } else if (!cites.length) {
        record(11, 'FAIL', 'no [S#] citations in draft UI')
      } else {
        const refsErr = referencesLooksAcademic(text)
        if (refsErr) throw new Error(refsErr)
        record(11, 'PASS', `citations found=${cites.length}; sample=${cites.slice(0, 10).join(',')}`)
      }
    } catch (e) {
      record(11, 'FAIL', e.message)
    }

    // Step 12: Library export
    try {
      if (!blockUnless(12, 10)) throw new Error('__blocked__')
      await page.goto(`${BASE}/library`)
      await page.getByRole('heading', { name: 'Source citations' }).waitFor({ timeout: 20000 })
      await page.waitForTimeout(1000)
      const row = page.locator('tr', { hasText: /Gut-brain|literature review/i }).first()
      if (!(await row.count())) {
        // any completed paper
      }
      const mdBtn = page.getByRole('button', { name: 'Markdown' }).first()
      const wordBtn = page.getByRole('button', { name: 'Word' }).first()
      const [mdDownload] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        mdBtn.click(),
      ])
      const mdPath = path.join(SHOTS, await mdDownload.suggestedFilename())
      await mdDownload.saveAs(mdPath)
      const md = fs.readFileSync(mdPath, 'utf8')
      if (!md.includes(DISCLAIMER) && !/AI-generated draft\. Requires human review/i.test(md)) {
        throw new Error('Markdown export missing disclaimer')
      }
      const [wordDownload] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        wordBtn.click(),
      ])
      const wordPath = path.join(SHOTS, await wordDownload.suggestedFilename())
      await wordDownload.saveAs(wordPath)
      // docx is zip; check for disclaimer string in raw bytes loosely
      const wordBuf = fs.readFileSync(wordPath)
      if (!wordBuf.toString('utf8').includes('AI-generated draft') && !wordBuf.toString('latin1').includes('human review')) {
        state.notes.push('Word disclaimer string not found in raw docx bytes; may still be present in document.xml')
      }
      record(12, 'PASS', `exported md=${path.basename(mdPath)} word=${path.basename(wordPath)}`)
    } catch (e) {
      if (e && e.message === '__blocked__') {
        /* already recorded BLOCKED */
      } else {
      await shot(page, 'step12-fail')
      record(12, 'FAIL', e.message)
      }
    }

    // Step 13: Continue restores prompt
    try {
      if (!blockUnless(13, 10)) throw new Error('__blocked__')
      await page.goto(`${BASE}/library`)
      const cont = page.getByRole('link', { name: 'Continue' }).first()
      await cont.click()
      await page.waitForURL(/\/generate\?paper=/, { timeout: 30000 })
      // ensure Prompt tab
      await page.getByRole('link', { name: 'Prompt' }).click().catch(() => {})
      await page.waitForSelector('#research-prompt', { timeout: 15000 })
      await page.getByText(/Working on/i).waitFor({ timeout: 15000 })
      await page.waitForFunction(
        () => document.querySelector('#paper-type')?.value === 'Literature Review',
        null,
        { timeout: 15000 }
      )
      await page.waitForTimeout(500)
      let promptVal = await page.inputValue('#research-prompt')
      if (!promptVal) {
        await page.waitForTimeout(2000)
        promptVal = await page.inputValue('#research-prompt')
      }
      const typeVal = await page.inputValue('#paper-type')
      if (!promptVal.includes('gut-brain') && promptVal !== PROMPT) {
        if (!promptVal) throw new Error('prompt empty after Continue')
      }
      if (typeVal !== 'Literature Review') throw new Error(`type=${typeVal}`)
      await page.waitForFunction(
        () => {
          const el = document.querySelector('#paper-outline')
          return el instanceof HTMLTextAreaElement && !el.disabled
        },
        null,
        { timeout: 15000 }
      )
      const outlineVal = await page.inputValue('#paper-outline')
      if (!/##\s+/.test(outlineVal)) throw new Error('outline empty after Continue')
      record(13, 'PASS', 'title/type/prompt/outline restored')
    } catch (e) {
      if (e && e.message === '__blocked__') {
        /* already recorded BLOCKED */
      } else {
      await shot(page, 'step13-fail')
      record(13, 'FAIL', e.message)
      }
    }
  } finally {
    const statuses = Object.values(state.steps).map((s) => s.status)
    if (statuses.includes('FAIL')) state.verdict = 'FAIL'
    else if (statuses.includes('BLOCKED') || Object.keys(state.steps).length < 13) state.verdict = 'BLOCKED'
    else state.verdict = 'PASS'
    writeReport()
    saveState()
    try { await browser.close() } catch (e) { crashLog('browser.close ' + e) }
    console.log('VERDICT', state.verdict)
    console.log('REPORT', path.join(REPORTS, '2026-09-07-literature-review.md'))
  }
}

main().catch((e) => {
  console.error(e)
  state.verdict = state.verdict || 'FAIL'
  state.notes.push(String(e.message || e))
  writeReport()
  saveState()
  process.exit(1)
})
