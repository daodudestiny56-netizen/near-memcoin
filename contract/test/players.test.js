import test from 'node:test'
import assert from 'node:assert/strict'
import { chain, tokens } from './helpers.js'
import { claim, getStats, gm, leaderboard, touch, updateStats } from '../src/core/players.js'
import { balanceOf } from '../src/core/token.js'
import { heartbeat } from '../src/core/heartbeat.js'

const DAY = 86_400

test('gm builds a streak across consecutive epochs', () => {
  const { as } = chain()
  assert.equal(gm(as('ana.testnet', 10)), 1)
  assert.equal(gm(as('ana.testnet', DAY + 10)), 2)
  assert.equal(gm(as('ana.testnet', 2 * DAY + 10)), 3)
  assert.equal(getStats(as('x', 3 * DAY), 'ana.testnet').best_streak, 3)
})

test('only one gm per epoch', () => {
  const { as } = chain()
  gm(as('ana.testnet', 10))
  assert.throws(() => gm(as('ana.testnet', 500)), /already said gm/)
})

test('missing an epoch resets the streak but keeps the best', () => {
  const { as } = chain()
  gm(as('ana.testnet', 10))
  gm(as('ana.testnet', DAY + 10))
  assert.equal(gm(as('ana.testnet', 3 * DAY + 10)), 1)
  assert.equal(getStats(as('x', 4 * DAY), 'ana.testnet').best_streak, 2)
})

test('gm counts toward the pulse', () => {
  const { as } = chain()
  gm(as('ana.testnet', 10))
  gm(as('bob.testnet', 20))
  assert.equal(heartbeat(as('x', 30)).pulse, 2)
})

test('faucet pays once per account and can be switched off', () => {
  const { as } = chain()
  claim(as('ana.testnet', 5))
  assert.equal(balanceOf(as('x'), 'ana.testnet'), tokens(1000))
  assert.throws(() => claim(as('ana.testnet', 6)), /already claimed/)
  as('owner.testnet').update('m', (m) => {
    m.faucet_on = false
  })
  assert.throws(() => claim(as('bob.testnet', 7)), /faucet is off/)
})

test('leaderboard ranks by xp and only indexes players with xp', () => {
  const { as } = chain()
  gm(as('ana.testnet', 10))
  updateStats(as('bob.testnet', 11), 'bob.testnet', (s) => {
    s.xp += 100
  })
  touch(as('cy.testnet', 12), 'cy.testnet')
  const board = leaderboard(as('x', 20))
  assert.deepEqual(board.map((p) => p.account), ['bob.testnet', 'ana.testnet'])
})
