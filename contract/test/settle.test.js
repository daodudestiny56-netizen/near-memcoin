import test from 'node:test'
import assert from 'node:assert/strict'
import { chain, tokens } from './helpers.js'
import { claim, getStats, gm } from '../src/core/players.js'
import { balanceOf } from '../src/core/token.js'
import { getQuest, join, propose, submitProof } from '../src/core/quests.js'
import { commitPreimage, commitVote, resolve, revealVote } from '../src/core/settle.js'
import { sha256Hex } from './helpers.js'

const DAY = 86_400
const SPEC = {
  title: 'Touch grass', description: 'Post a park photo', stake: tokens(25),
  submit_s: 600, commit_s: 600, reveal_s: 600,
}

// Quest windows (seconds after proposal): submit [0,600) commit [600,1200) reveal [1200,1800)
function setup(playerNames, options = {}) {
  const c = chain(options)
  const t0 = 3 * DAY + 100
  const everyone = ['proposer.testnet', ...playerNames]
  for (const who of everyone) claim(c.as(who, 5))
  // chain time only moves forward: everyone says gm on day 0, then day 1, then day 2
  for (let d = 0; d < 3; d++) for (const who of everyone) gm(c.as(who, d * DAY + 10))
  const id = propose(c.as('proposer.testnet', t0), { ...SPEC, ...options.spec })
  return { c, t0, id }
}

const vote = (c, t0, id, voter, entrant, salt = 's') => {
  commitVote(c.as(voter, t0 + 700), id, sha256Hex(commitPreimage(id, voter, entrant, salt)))
}
const reveal = (c, t0, id, voter, entrant, salt = 's') => revealVote(c.as(voter, t0 + 1300), id, entrant, salt)

// Conservation: the contract's balance is exactly what escrow + pools + rollover say it holds.
function assertEscrowBalanced(c, t) {
  const g = c.as('x', t)
  let expected = g.meta().rollover
  for (let id = 1; id < g.meta().next_quest; id++) {
    const q = getQuest(g, id)
    if (q.status !== 'ACTIVE') continue
    expected += q.pool + BigInt(q.entrants.length) * q.stake + BigInt(q.voters.length) * q.vote_stake
  }
  assert.equal(balanceOf(g, c.self), expected)
}

test('commit-reveal: happy path pays the winner and burns failed stakes', () => {
  const { c, t0, id } = setup(['a.testnet', 'b.testnet', 'c.testnet', 'v1.testnet', 'v2.testnet'], {
    spec: { seed: tokens(100) },
    config: { target_pulse: 6 }, // 6 players x gm = exactly one STEADY epoch
  })
  for (const who of ['a.testnet', 'b.testnet', 'c.testnet']) {
    join(c.as(who, t0 + 1), id)
    submitProof(c.as(who, t0 + 2), id, `proof by ${who}`)
  }
  vote(c, t0, id, 'v1.testnet', 'a.testnet')
  vote(c, t0, id, 'v2.testnet', 'a.testnet')
  assertEscrowBalanced(c, t0 + 800)
  reveal(c, t0, id, 'v1.testnet', 'a.testnet')
  reveal(c, t0, id, 'v2.testnet', 'a.testnet')
  const supplyBefore = c.as('x').meta().total_supply

  const result = resolve(c.as('anyone.testnet', t0 + 1900), id)
  const g = c.as('x', t0 + 1900)
  assert.deepEqual(result.winners, ['a.testnet'])
  // a: 1000 - 25 stake + 25 back + 100 pool
  assert.equal(balanceOf(g, 'a.testnet'), tokens(1100))
  // two losers forfeit 50 total; mood is STEADY: 50% burn = 25, 30% rollover = 15, 20% voters = 10
  assert.equal(g.meta().total_supply, supplyBefore - tokens(25))
  assert.equal(g.meta().rollover, tokens(15))
  assert.equal(getStats(g, 'b.testnet').scars, 1)
  assert.equal(getStats(g, 'a.testnet').wins, 1)
  assert.equal(result.correct_voters, 2)
  // each correct voter: 1000 - 5 + 5 back + 5 (half of the 10 voter pot)
  assert.equal(balanceOf(g, 'v1.testnet'), tokens(1005))
  assertEscrowBalanced(c, t0 + 1900)
})

test('wrong votes and unrevealed votes feed the voter pot', () => {
  const { c, t0, id } = setup(['a.testnet', 'b.testnet', 'c.testnet', 'v1.testnet', 'v2.testnet', 'v3.testnet'])
  for (const who of ['a.testnet', 'b.testnet', 'c.testnet']) {
    join(c.as(who, t0 + 1), id)
    submitProof(c.as(who, t0 + 2), id, 'p')
  }
  vote(c, t0, id, 'v1.testnet', 'a.testnet')
  vote(c, t0, id, 'v2.testnet', 'a.testnet')
  vote(c, t0, id, 'v3.testnet', 'b.testnet') // wrong
  reveal(c, t0, id, 'v1.testnet', 'a.testnet')
  reveal(c, t0, id, 'v3.testnet', 'b.testnet')
  // v2 never reveals: forfeits
  const result = resolve(c.as('x', t0 + 1900), id)
  const g = c.as('x', t0 + 1900)
  assert.deepEqual(result.winners, ['a.testnet'])
  assert.equal(result.correct_voters, 1)
  // voter pot = 20% of 50 (=10) + 2 forfeited stakes of 5 = 20; v1 gets 5 back + 20
  assert.equal(balanceOf(g, 'v1.testnet'), tokens(1020))
  assert.equal(balanceOf(g, 'v2.testnet'), tokens(995))
  assertEscrowBalanced(c, t0 + 1900)
})

test('a quest with no revealed votes is void and refunds everyone', () => {
  const { c, t0, id } = setup(['a.testnet', 'b.testnet'], { spec: { seed: tokens(40) } })
  join(c.as('a.testnet', t0 + 1), id)
  join(c.as('b.testnet', t0 + 1), id)
  const result = resolve(c.as('x', t0 + 1900), id)
  const g = c.as('x', t0 + 1900)
  assert.equal(result.reason, 'no revealed votes')
  assert.equal(balanceOf(g, 'a.testnet'), tokens(1000))
  assert.equal(g.meta().rollover, tokens(40))
  assert.equal(getQuest(g, id).status, 'VOID')
  assertEscrowBalanced(c, t0 + 1900)
})

test('a single entrant is void even with votes', () => {
  const { c, t0, id } = setup(['a.testnet', 'v1.testnet'])
  join(c.as('a.testnet', t0 + 1), id)
  submitProof(c.as('a.testnet', t0 + 2), id, 'p')
  vote(c, t0, id, 'v1.testnet', 'a.testnet')
  reveal(c, t0, id, 'v1.testnet', 'a.testnet')
  assert.equal(resolve(c.as('x', t0 + 1900), id).reason, 'too few entrants')
  assert.equal(balanceOf(c.as('x'), 'v1.testnet'), tokens(1000))
})

test('entrants without proof cannot win or be voted for', () => {
  const { c, t0, id } = setup(['a.testnet', 'b.testnet', 'v1.testnet'])
  join(c.as('a.testnet', t0 + 1), id)
  join(c.as('b.testnet', t0 + 1), id)
  submitProof(c.as('a.testnet', t0 + 2), id, 'p')
  vote(c, t0, id, 'v1.testnet', 'b.testnet')
  assert.throws(() => reveal(c, t0, id, 'v1.testnet', 'b.testnet'), /no proof/)
})

test('voting phases are enforced', () => {
  const { c, t0, id } = setup(['a.testnet', 'v1.testnet'])
  const commit = sha256Hex(commitPreimage(id, 'v1.testnet', 'a.testnet', 's'))
  assert.throws(() => commitVote(c.as('v1.testnet', t0 + 100), id, commit), /not started/)
  commitVote(c.as('v1.testnet', t0 + 700), id, commit)
  assert.throws(() => commitVote(c.as('v1.testnet', t0 + 701), id, commit), /already voted/)
  assert.throws(() => revealVote(c.as('v1.testnet', t0 + 800), id, 'a.testnet', 's'), /not started/)
  assert.throws(() => resolve(c.as('x', t0 + 1500), id), /still open/)
})

test('a reveal that does not match the commit is rejected, and self-votes too', () => {
  const { c, t0, id } = setup(['a.testnet', 'b.testnet', 'v1.testnet'])
  for (const who of ['a.testnet', 'b.testnet']) {
    join(c.as(who, t0 + 1), id)
    submitProof(c.as(who, t0 + 2), id, 'p')
  }
  vote(c, t0, id, 'v1.testnet', 'a.testnet')
  assert.throws(() => reveal(c, t0, id, 'v1.testnet', 'b.testnet'), /does not match/)
  vote(c, t0, id, 'a.testnet', 'a.testnet')
  assert.throws(() => reveal(c, t0, id, 'a.testnet', 'a.testnet'), /yourself/)
})

test('copying someone else\'s commit hash is useless', () => {
  const { c, t0, id } = setup(['a.testnet', 'b.testnet', 'v1.testnet', 'thief.testnet'])
  for (const who of ['a.testnet', 'b.testnet']) {
    join(c.as(who, t0 + 1), id)
    submitProof(c.as(who, t0 + 2), id, 'p')
  }
  const copied = sha256Hex(commitPreimage(id, 'v1.testnet', 'a.testnet', 's'))
  commitVote(c.as('v1.testnet', t0 + 700), id, copied)
  commitVote(c.as('thief.testnet', t0 + 701), id, copied)
  assert.throws(() => reveal(c, t0, id, 'thief.testnet', 'a.testnet'), /does not match/)
})

test('a settled quest cannot be settled twice', () => {
  const { c, t0, id } = setup(['a.testnet', 'b.testnet'])
  resolve(c.as('x', t0 + 1900), id)
  assert.throws(() => resolve(c.as('x', t0 + 2000), id), /already settled/)
})

test('a thriving coin burns more, a starving one rolls more over', () => {
  const run = (mood) => {
    const { c, t0, id } = setup(['a.testnet', 'b.testnet', 'c.testnet', 'v1.testnet'])
    for (const who of ['a.testnet', 'b.testnet', 'c.testnet']) {
      join(c.as(who, t0 + 1), id)
      submitProof(c.as(who, t0 + 2), id, 'p')
    }
    vote(c, t0, id, 'v1.testnet', 'a.testnet')
    reveal(c, t0, id, 'v1.testnet', 'a.testnet')
    c.as('x').update('hb', (hb) => {
      hb.mood = mood
      hb.epoch = Math.floor((t0 + 1900) / DAY)
    })
    return resolve(c.as('x', t0 + 1900), id)
  }
  const thriving = run('THRIVING')
  const starving = run('STARVING')
  assert.equal(thriving.burned, tokens(30))
  assert.equal(starving.burned, tokens(10))
  assert.equal(starving.rolled_over, tokens(30))
})
