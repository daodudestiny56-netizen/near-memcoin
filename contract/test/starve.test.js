import test from 'node:test'
import assert from 'node:assert/strict'
import { chain, tokens } from './helpers.js'
import { claim, gm } from '../src/core/players.js'
import { balanceOf, transfer } from '../src/core/token.js'
import { setExempt } from '../src/core/admin.js'
import { starve } from '../src/core/starve.js'

const DAY = 86_400

// ana holds 1000 MIRA and has been idle since the start; the coin has gone silent.
function quiet() {
  const c = chain({ config: { target_pulse: 4 } })
  claim(c.as('ana.testnet', 5))
  return { c, t: 5 * DAY }
}

test('a healthy coin cannot be starved', () => {
  const c = chain()
  claim(c.as('ana.testnet', 5))
  assert.throws(() => starve(c.as('keeper.testnet', 100), 'ana.testnet'), /not starving/)
})

test('a starving coin taxes idle holders: 80% to the pool, 20% to the keeper', () => {
  const { c, t } = quiet()
  const result = starve(c.as('keeper.testnet', t), 'ana.testnet')
  const g = c.as('x', t)
  assert.equal(result.taken, tokens(10)) // 1% of 1000
  assert.equal(balanceOf(g, 'ana.testnet'), tokens(990))
  assert.equal(balanceOf(g, 'keeper.testnet'), tokens(2))
  assert.equal(g.meta().rollover, tokens(8))
  assert.equal(balanceOf(g, c.self), tokens(8))
})

test('the same account can only be starved once per epoch', () => {
  const { c, t } = quiet()
  starve(c.as('keeper.testnet', t), 'ana.testnet')
  assert.throws(() => starve(c.as('keeper2.testnet', t + 5), 'ana.testnet'), /already starved/)
  starve(c.as('keeper2.testnet', t + DAY), 'ana.testnet') // next epoch, still idle
})

test('recently active players are protected', () => {
  const { c, t } = quiet()
  gm(c.as('ana.testnet', t - DAY / 2)) // active in epoch 4
  assert.throws(() => starve(c.as('keeper.testnet', t), 'ana.testnet'), /active recently/)
  // two epochs of silence later she is fair game again
  starve(c.as('keeper.testnet', t + DAY), 'ana.testnet')
})

test('exempt accounts, the treasury, the contract and yourself are safe', () => {
  const { c, t } = quiet()
  transfer(c.as('owner.testnet', 6), 'owner.testnet', 'dex.testnet', tokens(500))
  setExempt(c.as('owner.testnet', 7), 'dex.testnet', true)
  assert.throws(() => starve(c.as('keeper.testnet', t), 'dex.testnet'), /exempt/)
  assert.throws(() => starve(c.as('keeper.testnet', t), 'owner.testnet'), /exempt/)
  assert.throws(() => starve(c.as('keeper.testnet', t), c.self), /exempt/)
  assert.throws(() => starve(c.as('ana.testnet', t), 'ana.testnet'), /yourself/)
})

test('dust balances are left alone', () => {
  const { c, t } = quiet()
  transfer(c.as('owner.testnet', 6), 'owner.testnet', 'tiny.testnet', tokens(5))
  assert.throws(() => starve(c.as('keeper.testnet', t), 'tiny.testnet'), /too small/)
})

test('only the owner can change exemptions', () => {
  const { c } = quiet()
  assert.throws(() => setExempt(c.as('ana.testnet', 8), 'ana.testnet', true), /owner only/)
})
