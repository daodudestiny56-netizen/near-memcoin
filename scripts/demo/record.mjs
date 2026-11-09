// Films a real walkthrough of the MIRA app. Every click below drives the actual UI, and every
// action is a real testnet transaction, signed in Node by throwaway demo accounts through the
// recording-only signer (see src/chain/wallet.ts, VITE_DEMO_SIGNER).
//
//   VITE_DEMO_SIGNER=1 npx vite build --outDir dist-demo && npx vite preview --outDir dist-demo --port 5200
//   node scripts/demo/record.mjs <out-dir>
//
// It prints MARK / FAST lines that assemble.py uses to speed up waiting and to time the narration.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { call, loadAccount, view } from '../lib.mjs'

const URL = process.env.DEMO_URL ?? 'http://localhost:5200/'
const OUT = process.argv[2]
if (!OUT) throw new Error('usage: node scripts/demo/record.mjs <out-dir>')
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const id = (n) => `mira-${n}.testnet`
const QUEST = 'Teach a friend'

// TAKE=keeper (intro, moods, starvation tax, gm) needs a starving coin; TAKE=quest (default) is the quest flow
const TAKE = process.env.TAKE ?? 'quest'
if (!['keeper', 'quest'].includes(TAKE)) throw new Error('TAKE must be keeper or quest')
if (TAKE === 'keeper') {
  const overview = await view('get_overview')
  if (overview.mood !== 'STARVING') throw new Error(`mood is ${overview.mood}; the keeper scene needs STARVING`)
}

const signers = {}
const browser = await chromium.launch({ channel: 'chrome' })
const created = Date.now()
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
})
const page = await context.newPage()
await page.exposeFunction('__miraSendNode', async (account, method, args, deposit) => {
  signers[account] ??= loadAccount(account)
  await call(signers[account], method, args, { deposit: BigInt(deposit) })
})
await page.addInitScript(() => {
  window.__miraDemo = {
    account: null,
    pending: null,
    send: (a, m, args, d) => window.__miraSendNode(a, m, args, d),
  }
})
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => document.querySelector('.stat-strip dd')?.innerText.match(/\d/), null, { timeout: 40000 })
await sleep(1200)
const trimStart = (Date.now() - created) / 1000 - 0.3
const stamp = () => (Date.now() - created) / 1000 - trimStart
console.log('TRIM_START', trimStart.toFixed(2))
const mark = (name) => console.log('MARK', name, stamp().toFixed(2))
const fast = (a, b, factor) => console.log('FAST', a.toFixed(2), b.toFixed(2), factor)

await page.evaluate(() => {
  const style = document.createElement('style')
  style.textContent = `
    #fakecursor { position: fixed; left: 0; top: 0; width: 28px; height: 28px; z-index: 200000; pointer-events: none; transform: translate(-100px, -100px);
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }
    .ripple { position: fixed; z-index: 199999; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; pointer-events: none;
      border: 3px solid #1fa463; animation: rip .55s ease-out forwards; }
    @keyframes rip { to { transform: scale(4.2); opacity: 0; } }
    #chap { position: fixed; left: 28px; bottom: 26px; z-index: 99998; background: rgba(12,26,19,.92); color: #fff; padding: 11px 20px;
      border-radius: 99px; font: 600 19px 'Bricolage Grotesque', sans-serif; letter-spacing: -0.01em; opacity: 0; transition: opacity .3s;
      border: 1px solid rgba(216,240,107,.4); }
    #chap.on { opacity: 1; } #chap b { color: #d8f06b; margin-right: 8px; }
    #card { position: fixed; inset: 0; z-index: 100000; display: grid; place-items: center; text-align: center; color: #fff;
      background: radial-gradient(900px 500px at 70% 20%, rgba(216,240,107,.18), transparent 60%), #0c1a13; font-family: 'Bricolage Grotesque', sans-serif; transition: opacity .6s; }
    #card h1 { font-size: 104px; line-height: 1; margin: 0; font-weight: 800; letter-spacing: -0.05em; }
    #card h1 em { font-style: normal; color: #d8f06b; }
    #card p { font-size: 30px; color: #c9d4cc; margin: 18px 0 0; }
    #card small { display: block; margin-top: 30px; font-size: 21px; color: #93a699; line-height: 1.7; }
  `
  document.head.appendChild(style)
  const cur = document.createElement('div')
  cur.id = 'fakecursor'
  cur.innerHTML = '<svg viewBox="0 0 28 28" width="28" height="28"><path d="M4 2 L4 22 L9.5 17.2 L13.2 25.5 L16.8 23.9 L13.2 15.9 L20.5 15.5 Z" fill="#fff" stroke="#0c1a13" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  document.body.appendChild(cur)
  document.addEventListener('mousemove', (e) => { cur.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 2}px)` }, true)
  document.addEventListener('mousedown', (e) => {
    const r = document.createElement('div'); r.className = 'ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'
    document.body.appendChild(r); setTimeout(() => r.remove(), 700)
  }, true)
  const chap = document.createElement('div'); chap.id = 'chap'; document.body.appendChild(chap)
  const card = document.createElement('div'); card.id = 'card'
  card.innerHTML = '<div><h1>MIRA <em>is alive.</em></h1><p>The memecoin whose supply reacts to its community.</p><small>Live on NEAR testnet · Memecoins With Mechanics</small></div>'
  document.body.appendChild(card)
})

// ---------- helpers: a visible cursor, real clicks, real typing ----------
let cx = 640
let cy = 380
async function glide(x, y, ms = 400) {
  const steps = Math.max(8, Math.round(ms / 36))
  const sx = cx
  const sy = cy
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e)
    await sleep(8)
  }
  cx = x
  cy = y
}
async function center(loc, scroll = true) {
  let box = await loc.boundingBox()
  // only scroll when the element is outside the comfortable viewport band (header/chapter chip excluded)
  if (scroll && (!box || box.y < 110 || box.y + box.height > 640)) {
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
    await sleep(700)
    box = await loc.boundingBox()
  }
  if (!box) throw new Error('element not visible: ' + loc)
  return box
}
async function click(loc, { scroll = true, fx = 0.5 } = {}) {
  const box = await center(loc, scroll)
  await glide(box.x + box.width * fx, box.y + box.height / 2)
  await sleep(140)
  await page.mouse.down()
  await sleep(60)
  await page.mouse.up()
  await sleep(200)
}
async function typeInto(loc, text, delay = 55) {
  await click(loc)
  await page.keyboard.type(text, { delay })
  await sleep(250)
}
async function scrollToSection(sel, ms = 1300) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), sel)
  await sleep(ms)
}
const chapter = async (n, text) => {
  await page.evaluate(([a, b]) => {
    const c = document.getElementById('chap')
    if (!b) { c.classList.remove('on'); return }
    c.innerHTML = `<b>${a}</b>${b}`
    c.classList.add('on')
  }, [n, text])
}

// wait for the app's busy indicator to clear; the wait is sped up in the edit
async function waitTx() {
  await page.locator('.toast.info').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  await sleep(700)
  const a = stamp()
  await page.locator('.toast.info').waitFor({ state: 'hidden', timeout: 90000 })
  fast(a, stamp(), 3)
  await sleep(500)
  if ((await page.locator('.toast.error').count()) > 0) throw new Error('tx failed: ' + (await page.locator('.toast.error').first().innerText()))
}
async function waitChip(title, text) {
  const a = stamp()
  await page.waitForFunction(([t, want]) => {
    const card = [...document.querySelectorAll('.quest')].find((c) => c.querySelector('h3')?.textContent === t)
    return card?.querySelector('.chip-plain')?.textContent === want
  }, [title, text], { timeout: 480000, polling: 500 })
  fast(a, stamp(), 8)
}
const header = (text) => page.locator('header.topbar button', { hasText: text })
async function switchTo(name) {
  if (await header('Sign out').count()) await click(header('Sign out'), { scroll: false })
  await page.evaluate((a) => { window.__miraDemo.pending = a }, id(name))
  await click(header('Connect wallet'), { scroll: false })
  await page.waitForFunction((a) => document.querySelector('.wallet-info strong')?.textContent?.includes(a), name, { timeout: 15000 })
  await sleep(900)
}
const card = () => page.locator('.quest', { has: page.locator('h3', { hasText: QUEST }) }).first()

// ---------- the story ----------
async function keeperTake() {
  mark('title')
  await glide(900, 360, 300)
  await sleep(4300)
  await page.evaluate(() => { const c = document.getElementById('card'); c.style.opacity = 0; setTimeout(() => c.remove(), 700) })
  await sleep(900)

  mark('hero')
  await chapter('1', 'Live on NEAR testnet')
  await sleep(7000)

  mark('moods')
  await chapter('2', 'Four moods, four burn rates')
  await scrollToSection('#vitals', 1500)
  await page.evaluate(() => window.scrollBy({ top: 330, behavior: 'smooth' }))
  await sleep(1200)
  for (const m of ['Thriving', 'Steady', 'Hungry', 'Starving', 'Live']) {
    await click(page.locator('.mood-picker .pick', { hasText: m }).first(), { scroll: false })
    await sleep(m === 'Live' ? 800 : 1600)
  }

  mark('connect')
  await chapter('3', 'Connect a wallet')
  await scrollToSection('#top', 1200)
  await page.evaluate(() => { window.__miraDemo.pending = 'mira-ana.testnet' })
  await click(header('Connect wallet'), { scroll: false })
  await page.waitForFunction(() => document.querySelector('.wallet-info strong')?.textContent?.includes('ana'), null, { timeout: 15000 })
  await sleep(1600)

  mark('keeper')
  await chapter('4', 'MIRA is starving: feed it')
  await scrollToSection('#rituals', 1400)
  await sleep(2500)
  await typeInto(page.locator('.keeper input'), id('idle'))
  await sleep(600)
  await click(page.getByRole('button', { name: 'Feed MIRA' }))
  await waitTx()
  await sleep(1800)
  await scrollToSection('#feed', 1300)
  await sleep(2600)

  mark('gm')
  await chapter('5', 'Say gm, build a streak')
  await scrollToSection('#rituals', 1300)
  await click(page.getByRole('button', { name: 'Say gm' }))
  await waitTx()
  await sleep(2200)
  mark('keeper_end')
}

async function questTake() {
  mark('connect2')
  await sleep(1500)
  await chapter('6', 'Connect as a player')
  await scrollToSection('#top', 900)
  await page.evaluate(() => { window.__miraDemo.pending = 'mira-ana.testnet' })
  await click(header('Connect wallet'), { scroll: false })
  await page.waitForFunction(() => document.querySelector('.wallet-info strong')?.textContent?.includes('ana'), null, { timeout: 15000 })
  await sleep(1200)

  mark('propose')
  await chapter('7', 'Burn MIRA to propose a quest')
  await scrollToSection('#quests', 1300)
  await click(page.getByRole('button', { name: 'Propose a quest' }))
  await sleep(700)
  await typeInto(page.locator('.modal label', { hasText: 'Title' }).locator('input'), QUEST)
  await typeInto(page.locator('.modal textarea'), 'Show a friend how MIRA works.', 28)
  await click(page.locator('.modal .two input').nth(0))
  await page.keyboard.press('Control+A')
  await page.keyboard.type('20', { delay: 90 })
  await click(page.locator('.modal .two input').nth(1))
  await page.keyboard.press('Control+A')
  await page.keyboard.type('30', { delay: 90 })
  await sleep(500)
  await click(page.locator('.modal .choice', { hasText: 'Relaxed entry' }))
  await sleep(700)
  await click(page.locator('.modal button.btn-primary'))
  await waitTx()
  await card().waitFor({ state: 'visible', timeout: 30000 })
  await sleep(1500)

  mark('enter')
  await chapter('8', 'Stake to enter, post proof')
  for (const [n, proof] of [['bob', 'https://x.com/bob/status/1'], ['cy', 'https://x.com/cy/status/2'], ['dee', 'https://x.com/dee/status/3']]) {
    mark('enter_' + n)
    await scrollToSection('#quests', 700)
    await switchTo(n)
    await click(card().getByRole('button', { name: /to enter/ }))
    await waitTx()
    await typeInto(card().locator('input'), proof, 28)
    await click(card().getByRole('button', { name: /Submit proof/ }))
    await waitTx()
    await sleep(600)
  }

  mark('wait_vote')
  await chapter('9', 'Entries closed. Voting opens')
  await scrollToSection('#quests', 900)
  await waitChip(QUEST, 'Voting')
  await sleep(1200)

  mark('vote')
  await chapter('10', 'Vote in secret: only a hash goes on-chain')
  for (const n of ['eve', 'ana']) {
    mark('vote_' + n)
    await switchTo(n)
    await click(card().locator('.choice', { hasText: 'dee' }))
    await click(card().getByRole('button', { name: /seal vote/ }))
    await waitTx()
    await sleep(1300)
  }

  mark('wait_reveal')
  await chapter('11', 'Reveal: votes are opened and checked')
  await waitChip(QUEST, 'Revealing')
  await sleep(1000)

  mark('reveal')
  for (const n of ['eve', 'ana']) {
    mark('reveal_' + n)
    await switchTo(n)
    await click(card().getByRole('button', { name: /Reveal my vote/ }))
    await waitTx()
    await sleep(1200)
  }

  mark('wait_settle')
  await chapter('12', 'Anyone can settle')
  await waitChip(QUEST, 'Settle')
  await sleep(800)

  mark('settle')
  await click(card().getByRole('button', { name: /Settle quest/ }))
  await waitTx()
  await sleep(3000)

  mark('burn')
  await chapter('13', 'Failed stakes burn on-chain')
  await scrollToSection('#feed', 1300)
  await sleep(5500)
  await scrollToSection('#top', 1500)
  await sleep(3600)

  mark('board')
  await chapter('14', 'Winners earn XP, losers earn scars')
  await scrollToSection('#leaderboard', 1400)
  await sleep(4500)

  mark('rules')
  await chapter('15', 'No mint. No admin over funds')
  await scrollToSection('#rules', 1400)
  await page.evaluate(() => window.scrollBy({ top: 320, behavior: 'smooth' }))
  await sleep(7000)

  mark('end')
  await chapter('', '')
  await page.evaluate(() => {
    const c = document.createElement('div'); c.id = 'card'; c.style.opacity = 0
    c.innerHTML = '<div><h1>MIRA <em>is alive.</em></h1><p>mira-memecoin.vercel.app</p><small>Contract: mira-memecoin.testnet<br/>github.com/daodudestiny56-netizen/near-memcoin<br/>Recorded with testnet accounts · #NEARHackathon</small></div>'
    document.body.appendChild(c); requestAnimationFrame(() => { c.style.opacity = 1 })
  })
  await sleep(5200)
}

if (TAKE === 'keeper') await keeperTake()
else {
  // the quest take has no title card: remove it right away
  await page.evaluate(() => document.getElementById('card')?.remove())
  await questTake()
}
console.log('END', stamp().toFixed(2))
const video = page.video()
await context.close()
console.log('VIDEO', await video.path())
await browser.close()
