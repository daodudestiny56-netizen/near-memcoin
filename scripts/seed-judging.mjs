// Leaves the live testnet contract with three quests parked in different phases, so a reviewer always
// finds something to try during the judging window. Every step is a real testnet transaction.
//   enter  : entries stay open for 8 days          -> a judge can join, post proof
//   vote   : entries closed, voting open for 8 days -> a judge can cast a sealed vote
//   settle : votes revealed, settleable in 5.5 days -> a judge can press "Settle" and watch the burn
// Usage: node scripts/seed-judging.mjs
import { createHash } from 'node:crypto'
import { call as rawCall, loadAccount, sleep, tokens, view } from './lib.mjs'

const DAY = 86_400
const id = (n) => `mira-${n}.testnet`
const acc = Object.fromEntries(['ana', 'bob', 'cy', 'dee', 'eve'].map((n) => [n, loadAccount(id(n))]))
const sha256Hex = (text) => createHash('sha256').update(text).digest('hex')
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const proof = (n) => `Seeded demo entry from ${id(n)} (scripts/seed-judging.mjs)`

// Public RPCs throttle bursts: retry infrastructure errors, and treat a step that already landed as done.
async function call(account, method, args) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await rawCall(account, method, args)
    } catch (e) {
      if (/already (joined|voted|revealed)/.test(e.message)) return null
      if (!/Exceeded|429|fetch|timeout|ECONN|socket/i.test(e.message) || attempt >= 5) throw e
      await sleep(1500 * (attempt + 1))
    }
  }
}

async function waitForPhase(questId, phase) {
  for (;;) {
    if ((await view('get_quest', { id: questId })).phase === phase) return
    await sleep(1000)
  }
}

for (const n of Object.keys(acc)) {
  if ((await view('get_player', { account_id: id(n) })).gm_available) await call(acc[n], 'gm')
}

// 1. ENTER: long entry window, two seeded entries already in.
const enter = await call(acc.dee, 'propose_quest', {
  title: 'Judges: enter this quest',
  description: 'Stake 10 MIRA and post a proof (any link or note). Entries are open for 8 days.',
  stake: tokens(10).toString(), seed: tokens(40).toString(),
  submit_s: 8 * DAY, commit_s: 2 * DAY, reveal_s: 2 * DAY,
})
for (const n of ['cy', 'eve']) {
  await call(acc[n], 'join_quest', { id: enter })
  await call(acc[n], 'submit_proof', { id: enter, proof: proof(n) })
}
log(`#${enter} ENTER: open for 8 days, 2 entries`)

// 2. VOTE: a short entry window (already closed by the time we finish), then 8 days of voting.
const vote = await call(acc.bob, 'propose_quest', {
  title: 'Judges: cast a sealed vote',
  description: 'Entries are closed. Stake 2 MIRA, seal a vote for an entry, and reveal it in the next phase.',
  stake: tokens(10).toString(), seed: tokens(30).toString(),
  submit_s: 120, commit_s: 8 * DAY, reveal_s: 3 * DAY,
})
await Promise.all(['cy', 'dee', 'eve'].map(async (n) => {
  await call(acc[n], 'join_quest', { id: vote })
  await call(acc[n], 'submit_proof', { id: vote, proof: proof(n) })
}))
log(`#${vote} VOTE: 3 entries in, voting open for 8 days`)

// 3. SETTLE: fully played up to the reveal, so anyone can settle it once the reveal window ends.
const settle = await call(acc.ana, 'propose_quest', {
  title: 'Judges: settle this quest',
  description: 'Votes are already revealed. When the reveal window ends, anyone can settle it and trigger the burn.',
  stake: tokens(10).toString(), seed: tokens(20).toString(),
  submit_s: 120, commit_s: 90, reveal_s: Math.round(5.5 * DAY),
})
await Promise.all(['cy', 'dee', 'eve'].map(async (n) => {
  await call(acc[n], 'join_quest', { id: settle })
  await call(acc[n], 'submit_proof', { id: settle, proof: proof(n) })
}))
log(`#${settle} SETTLE: 3 entries in, waiting for the commit window`)
await waitForPhase(settle, 'COMMIT')
const salt = `judging-${settle}`
const picks = { bob: 'dee', ana: 'dee' }
for (const [voter, pick] of Object.entries(picks)) {
  await call(acc[voter], 'commit_vote', { id: settle, commit: sha256Hex(`${settle}:${id(voter)}:${id(pick)}:${salt}`) })
}
await waitForPhase(settle, 'REVEAL')
for (const [voter, pick] of Object.entries(picks)) {
  await call(acc[voter], 'reveal_vote', { id: settle, entrant: id(pick), salt })
}

for (const qid of [enter, vote, settle]) {
  const q = await view('get_quest', { id: qid })
  log(`#${qid} ${q.phase.padEnd(6)} ${q.title} | entries ${q.entrants} votes ${q.voters} | reveal ends ${new Date(Number(BigInt(q.reveal_end) / 1_000_000n)).toISOString()}`)
}
const o = await view('get_overview')
log('overview:', { mood: o.mood, pulse: o.pulse, burned: o.burned, quests: o.quests_created })
