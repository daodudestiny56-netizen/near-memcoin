import test from 'node:test'
import assert from 'node:assert/strict'
import { chain, tokens } from './helpers.js'
import { gm, claim } from '../src/core/players.js'
import { balanceOf } from '../src/core/token.js'
import { entries, getQuest, join, listQuests, phaseOf, propose, submitProof } from '../src/core/quests.js'

const DAY = 86_400
const SPEC = {
  title: 'Touch grass', description: 'Post a park photo', stake: tokens(25),
  submit_s: 600, commit_s: 600, reveal_s: 600,
}

// A proposer who has done the daily ritual long enough, with funds.
function ready(c, who = 'ana.testnet') {
  claim(c.as(who, 5))
  for (let d = 0; d < 3; d++) gm(c.as(who, d * DAY + 10))
  return 3 * DAY + 100
}

test('proposing needs a gm streak', () => {
  const c = chain()
  claim(c.as('ana.testnet', 5))
  assert.throws(() => propose(c.as('ana.testnet', 20), SPEC), /gm streak/)
})

test('propose burns MIRA and creates an active quest', () => {
  const c = chain()
  const t = ready(c)
  const before = c.as('x', t).meta().total_supply
  const id = propose(c.as('ana.testnet', t), SPEC)
  const g = c.as('x', t)
  assert.equal(id, 1)
  assert.equal(g.meta().total_supply, before - tokens(50))
  assert.equal(getQuest(g, 1).status, 'ACTIVE')
  assert.equal(phaseOf(getQuest(g, 1), g.ctx.now), 'SUBMIT')
})

test('a seed moves into escrow and the rollover is inherited once', () => {
  const c = chain()
  const t = ready(c)
  c.as('x', t).update('m', (m) => {
    m.rollover = tokens(40)
  })
  propose(c.as('ana.testnet', t), { ...SPEC, seed: tokens(100) })
  const g = c.as('x', t)
  assert.equal(getQuest(g, 1).pool, tokens(140))
  assert.equal(g.meta().rollover, 0n)
  assert.equal(balanceOf(g, c.self), tokens(100))
})

test('propose validates inputs', () => {
  const c = chain()
  const t = ready(c)
  const as = () => c.as('ana.testnet', t)
  assert.throws(() => propose(as(), { ...SPEC, title: 'x' }), /title/)
  assert.throws(() => propose(as(), { ...SPEC, stake: 1n }), /stake/)
  assert.throws(() => propose(as(), { ...SPEC, reveal_s: 1 }), /reveal_s/)
})

test('join escrows the stake, once, before the deadline', () => {
  const c = chain()
  const t = ready(c)
  propose(c.as('ana.testnet', t), SPEC)
  claim(c.as('bob.testnet', t))
  join(c.as('bob.testnet', t + 1), 1)
  assert.equal(balanceOf(c.as('x'), 'bob.testnet'), tokens(975))
  assert.equal(balanceOf(c.as('x'), c.self), tokens(25))
  assert.throws(() => join(c.as('bob.testnet', t + 2), 1), /already joined/)
  claim(c.as('cy.testnet', t))
  assert.throws(() => join(c.as('cy.testnet', t + 601), 1), /closed/)
})

test('joining without funds fails and leaves no trace', () => {
  const c = chain()
  const t = ready(c)
  propose(c.as('ana.testnet', t), SPEC)
  assert.throws(() => join(c.as('broke.testnet', t + 1), 1), /insufficient/)
  assert.equal(getQuest(c.as('x', t), 1).entrants.length, 0)
})

test('proof can be updated until the deadline, then locks', () => {
  const c = chain()
  const t = ready(c)
  propose(c.as('ana.testnet', t), SPEC)
  claim(c.as('bob.testnet', t))
  assert.throws(() => submitProof(c.as('bob.testnet', t + 1), 1, 'ipfs://a'), /join the quest first/)
  join(c.as('bob.testnet', t + 1), 1)
  submitProof(c.as('bob.testnet', t + 2), 1, 'ipfs://a')
  submitProof(c.as('bob.testnet', t + 3), 1, 'ipfs://b')
  assert.equal(entries(c.as('x', t), 1)[0].proof, 'ipfs://b')
  assert.throws(() => submitProof(c.as('bob.testnet', t + 700), 1, 'late'), /closed/)
})

test('listQuests returns newest first', () => {
  const c = chain()
  const t = ready(c)
  propose(c.as('ana.testnet', t), SPEC)
  propose(c.as('ana.testnet', t + 1), { ...SPEC, title: 'Second' })
  assert.deepEqual(listQuests(c.as('x', t + 2)).map((q) => q.title), ['Second', 'Touch grass'])
})
