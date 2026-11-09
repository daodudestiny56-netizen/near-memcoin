// Plays one quest on testnet with short phases, printing a line per step.
// Used to record the demo video against the live contract (every step is a real transaction).
// Usage: node scripts/demo-quest.mjs
import { createHash } from 'node:crypto'
import { call, loadAccount, sleep, tokens, view } from './lib.mjs'

const names = ['ana', 'bob', 'cy', 'dee', 'eve']
const acc = Object.fromEntries(names.map((n) => [n, loadAccount(`mira-${n}.testnet`)]))
const id = (n) => `mira-${n}.testnet`
const sha256Hex = (text) => createHash('sha256').update(text).digest('hex')
const say = (tag, text) => console.log(`${tag}|${text}`)

async function waitForPhase(questId, phase) {
  for (;;) {
    const q = await view('get_quest', { id: questId })
    if (q.phase === phase) return
    await sleep(700)
  }
}

for (const n of names) {
  const p = await view('get_player', { account_id: id(n) })
  if (p.gm_available) await call(acc[n], 'gm')
}

const questId = await call(acc.ana, 'propose_quest', {
  title: 'Bring one friend',
  description: 'Introduce a new builder to MIRA and help them finish their first quest.',
  stake: tokens(20).toString(),
  seed: tokens(60).toString(),
  submit_s: 32, commit_s: 22, reveal_s: 22,
})
say('PROPOSED', `Quest #${questId}: mira-ana burns 50 MIRA to propose it and seeds the pool`)

await Promise.all(['cy', 'dee', 'eve'].map(async (n) => {
  await call(acc[n], 'join_quest', { id: questId })
  await call(acc[n], 'submit_proof', { id: questId, proof: `https://friends.example/${n}-onboarded-${questId}` })
}))
say('ENTERED', 'Three players stake 20 MIRA each and post proof')

await waitForPhase(questId, 'COMMIT')
const salt = `demo-${questId}`
const picks = { bob: 'dee', ana: 'dee' }
await Promise.all(Object.entries(picks).map(([voter, pick]) =>
  call(acc[voter], 'commit_vote', { id: questId, commit: sha256Hex(`${questId}:${id(voter)}:${id(pick)}:${salt}`) })))
say('SEALED', 'Two holders stake to vote. Only hashes are on-chain, so nobody can copy the crowd')

await waitForPhase(questId, 'REVEAL')
await Promise.all(Object.entries(picks).map(([voter, pick]) =>
  call(acc[voter], 'reveal_vote', { id: questId, entrant: id(pick), salt })))
say('REVEALED', 'Votes are opened and checked against the hashes')

await waitForPhase(questId, 'SETTLE')
const r = await call(acc.cy, 'resolve_quest', { id: questId })
say('SETTLED', `Winner ${r.winners[0]}. ${Number(BigInt(r.burned) / 10n ** 16n) / 100} MIRA burned forever (mood ${r.mood})`)
