// Plays a real quest on testnet so the app (and the demo video) show genuine on-chain activity.
// Usage: node scripts/seed.mjs            full quest: propose -> join -> vote -> reveal -> settle, plus one open quest
//        node scripts/seed.mjs --open-only  only leave a fresh open quest
import { createHash } from 'node:crypto'
import { call, loadAccount, sleep, tokens, view } from './lib.mjs'

const names = ['ana', 'bob', 'cy', 'dee', 'eve']
const accounts = Object.fromEntries(names.map((n) => [n, loadAccount(`mira-${n}.testnet`)]))
const id = (n) => `mira-${n}.testnet`
const sha256Hex = (text) => createHash('sha256').update(text).digest('hex')
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

async function waitForPhase(questId, phase) {
  for (;;) {
    const q = await view('get_quest', { id: questId })
    if (q.phase === phase) return q
    await sleep(1000)
  }
}

async function ensureSetup() {
  for (const n of names) {
    const p = await view('get_player', { account_id: id(n) })
    if (BigInt(p.balance) === 0n && p.xp === 0) {
      await call(accounts[n], 'claim').catch((e) => log(n, e.message))
    }
  }
  await Promise.all(names.map(async (n) => {
    const p = await view('get_player', { account_id: id(n) })
    if (p.gm_available) await call(accounts[n], 'gm')
  }))
  log('everyone has claimed and said gm')
}

async function proposeQuest(spec) {
  return call(accounts.ana, 'propose_quest', spec)
}

async function fullQuest() {
  const questId = await proposeQuest({
    title: 'Touch grass',
    description: 'Post a photo from your local park. The community votes on the most wholesome proof.',
    stake: tokens(25).toString(),
    seed: tokens(100).toString(),
    submit_s: 50, commit_s: 35, reveal_s: 35,
  })
  log(`quest #${questId} proposed (burned 50 MIRA)`)

  const entrants = ['bob', 'cy', 'dee']
  await Promise.all(entrants.map(async (n) => {
    await call(accounts[n], 'join_quest', { id: questId })
    await call(accounts[n], 'submit_proof', { id: questId, proof: `https://photos.example/${n}-park-${questId}` })
  }))
  log('3 entrants joined with proof')

  await waitForPhase(questId, 'COMMIT')
  const salt = 'mira-demo'
  const picks = { eve: 'bob', ana: 'bob' }
  await Promise.all(Object.entries(picks).map(([voter, pick]) => {
    const commit = sha256Hex(`${questId}:${id(voter)}:${id(pick)}:${salt}`)
    return call(accounts[voter], 'commit_vote', { id: questId, commit })
  }))
  log('2 votes sealed')

  await waitForPhase(questId, 'REVEAL')
  await Promise.all(Object.entries(picks).map(([voter, pick]) =>
    call(accounts[voter], 'reveal_vote', { id: questId, entrant: id(pick), salt })))
  log('votes revealed')

  await waitForPhase(questId, 'SETTLE')
  const result = await call(accounts.dee, 'resolve_quest', { id: questId })
  log('settled:', JSON.stringify(result))
}

async function openQuest() {
  const questId = await proposeQuest({
    title: 'Meme the market',
    description: "Explain today's market move in one meme. Clarity wins, doomposting burns.",
    stake: tokens(10).toString(),
    seed: tokens(50).toString(),
    submit_s: 3600, commit_s: 3600, reveal_s: 3600,
  })
  await call(accounts.bob, 'join_quest', { id: questId })
  await call(accounts.bob, 'submit_proof', { id: questId, proof: 'https://x.com/mira/status/meme-bob' })
  await call(accounts.cy, 'join_quest', { id: questId })
  log(`quest #${questId} left open for 1 hour per phase`)
}

if (!process.argv.includes('--open-only')) {
  await ensureSetup()
  await fullQuest()
}
await openQuest()
const o = await view('get_overview')
log('overview:', { mood: o.mood, pulse: o.pulse, burned: o.burned, quests: o.quests_created })
