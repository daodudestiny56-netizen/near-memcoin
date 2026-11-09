import test from 'node:test'
import assert from 'node:assert/strict'
import { chain, tokens } from './helpers.js'
import { claim, gm } from '../src/core/players.js'
import { propose } from '../src/core/quests.js'
import { TOTAL_SUPPLY } from '../src/core/constants.js'
import { overview, player, questDetail } from '../src/core/views.js'
import { plain } from '../src/core/codec.js'

const DAY = 86_400

test('overview reports supply, circulation and mood on a fresh chain', () => {
  const c = chain()
  const o = overview(c.as('x', 5))
  assert.equal(o.total_supply, TOTAL_SUPPLY)
  assert.equal(o.circulating, 0n)
  assert.equal(o.treasury, TOTAL_SUPPLY)
  assert.equal(o.mood, 'STEADY')
})

test('circulating supply grows as the faucet pays out and shrinks on burn', () => {
  const c = chain()
  claim(c.as('ana.testnet', 5))
  for (let d = 0; d < 3; d++) gm(c.as('ana.testnet', d * DAY + 10))
  propose(c.as('ana.testnet', 3 * DAY + 100), {
    title: 'Touch grass', description: '', stake: tokens(25), submit_s: 600, commit_s: 600, reveal_s: 600,
  })
  const o = overview(c.as('x', 3 * DAY + 200))
  assert.equal(o.circulating, tokens(950)) // 1000 claimed - 50 burned by the proposal
  assert.equal(o.burned, tokens(50))
  assert.equal(o.quests_created, 1)
})

test('views are JSON-safe once plain() is applied', () => {
  const c = chain()
  const out = plain(overview(c.as('x', 5)))
  assert.equal(out.total_supply, TOTAL_SUPPLY.toString())
})

test('player view says whether gm is available and whether they can be starved', () => {
  const c = chain({ config: { target_pulse: 4 } })
  assert.equal(player(c.as('x', 10), 'ana.testnet').gm_available, true)
  gm(c.as('ana.testnet', 10))
  assert.equal(player(c.as('x', 20), 'ana.testnet').gm_available, false)
  assert.equal(player(c.as('x', 20), 'ana.testnet').starvable, false)
  assert.equal(player(c.as('x', 6 * DAY), 'ana.testnet').starvable, true)
})

test('questDetail exposes the phase and entries', () => {
  const c = chain()
  claim(c.as('ana.testnet', 5))
  for (let d = 0; d < 3; d++) gm(c.as('ana.testnet', d * DAY + 10))
  propose(c.as('ana.testnet', 3 * DAY + 100), {
    title: 'Touch grass', description: '', stake: tokens(25), submit_s: 600, commit_s: 600, reveal_s: 600,
  })
  const q = questDetail(c.as('x', 3 * DAY + 200), 1)
  assert.equal(q.phase, 'SUBMIT')
  assert.deepEqual(q.entries, [])
})
