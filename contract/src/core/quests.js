import { NS, ONE } from './constants.js'
import { req } from './codec.js'
import { burn, move } from './token.js'
import { pulse } from './heartbeat.js'
import { getStats, touch, updateStats } from './players.js'

export const qKey = (id) => `q:${id}`
export const eKey = (id, account) => `qe:${id}:${account}`
export const vKey = (id, account) => `qv:${id}:${account}`

export function getQuest(g, id) {
  const quest = g.read(qKey(id))
  req(quest, `quest ${id} not found`)
  return quest
}

// Burn-to-propose: the proposer burns MIRA and (optionally) seeds the pool.
// Failed stakes from earlier quests (the rollover) flow into the new pool.
export function propose(g, args) {
  const cfg = g.cfg()
  const who = g.ctx.caller
  const { title, description, stake, seed = 0n, submit_s, commit_s, reveal_s } = args
  req(typeof title === 'string' && title.length >= 3 && title.length <= 80, 'title must be 3-80 chars')
  req(typeof description === 'string' && description.length <= 280, 'description max 280 chars')
  req(stake >= BigInt(cfg.min_stake) * ONE, `stake must be at least ${cfg.min_stake} MIRA`)
  for (const [name, secs] of [['submit_s', submit_s], ['commit_s', commit_s], ['reveal_s', reveal_s]]) {
    req(Number.isInteger(secs) && secs >= cfg.min_phase_s && secs <= cfg.max_phase_s, `${name} out of range`)
  }
  req(getStats(g, who).streak >= cfg.propose_streak, `need a gm streak of ${cfg.propose_streak} to propose`)

  burn(g, who, BigInt(cfg.propose_burn) * ONE, 'propose')
  if (seed > 0n) move(g, who, g.ctx.self, seed)

  let id = 0
  let inherited = 0n
  g.update('m', (m) => {
    id = m.next_quest
    m.next_quest += 1
    inherited = m.rollover
    m.rollover = 0n
  })
  const submit_end = g.ctx.now + BigInt(submit_s) * NS
  const commit_end = submit_end + BigInt(commit_s) * NS
  const reveal_end = commit_end + BigInt(reveal_s) * NS
  const minVote = BigInt(cfg.min_stake) * ONE
  g.write(qKey(id), {
    id, proposer: who, title, description, stake,
    vote_stake: stake / 5n > minVote ? stake / 5n : minVote,
    pool: seed + inherited, created: g.ctx.now,
    submit_end, commit_end, reveal_end,
    status: 'ACTIVE', entrants: [], voters: [], result: null,
  })
  pulse(g, 1)
  touch(g, who)
  updateStats(g, who, (s) => {
    s.xp += 15
  })
  g.emit('QUEST_PROPOSED', { id, proposer: who, title, stake, pool: seed + inherited })
  return id
}

export function join(g, id) {
  const cfg = g.cfg()
  const who = g.ctx.caller
  const quest = getQuest(g, id)
  req(quest.status === 'ACTIVE', 'quest is closed')
  req(g.ctx.now < quest.submit_end, 'entries are closed')
  req(quest.entrants.length < cfg.max_entrants, 'quest is full')
  req(!quest.entrants.includes(who), 'already joined')
  move(g, who, g.ctx.self, quest.stake)
  quest.entrants.push(who)
  g.write(qKey(id), quest)
  g.write(eKey(id, who), { proof: null, tally: 0 })
  pulse(g, 1)
  touch(g, who)
  updateStats(g, who, (s) => {
    s.xp += 2
  })
  g.emit('JOINED', { id, account: who, stake: quest.stake })
}

export function submitProof(g, id, proof) {
  const who = g.ctx.caller
  const quest = getQuest(g, id)
  req(quest.status === 'ACTIVE', 'quest is closed')
  req(g.ctx.now < quest.submit_end, 'proof window is closed')
  req(typeof proof === 'string' && proof.length >= 1 && proof.length <= 280, 'proof must be 1-280 chars')
  const entry = g.read(eKey(id, who))
  req(entry, 'join the quest first')
  entry.proof = proof
  g.write(eKey(id, who), entry)
  touch(g, who)
  g.emit('PROOF', { id, account: who })
}

export function listQuests(g, from = 1, limit = 20) {
  const next = g.meta().next_quest
  const out = []
  for (let id = Math.min(next - 1, from + limit - 1); id >= from && out.length < limit; id--) {
    const q = g.read(qKey(id))
    if (q) out.push(summary(g, q))
  }
  return out
}

export function summary(g, q) {
  return {
    id: q.id, proposer: q.proposer, title: q.title, description: q.description,
    stake: q.stake, vote_stake: q.vote_stake, pool: q.pool, status: q.status,
    submit_end: q.submit_end, commit_end: q.commit_end, reveal_end: q.reveal_end,
    entrants: q.entrants.length, voters: q.voters.length, result: q.result,
    phase: phaseOf(q, g.ctx.now),
  }
}

export function phaseOf(q, now) {
  if (q.status !== 'ACTIVE') return q.status
  if (now < q.submit_end) return 'SUBMIT'
  if (now < q.commit_end) return 'COMMIT'
  if (now < q.reveal_end) return 'REVEAL'
  return 'SETTLE'
}

export function entries(g, id) {
  const q = getQuest(g, id)
  return q.entrants.map((account) => ({ account, ...g.read(eKey(id, account)) }))
}
