import test from 'node:test'
import assert from 'node:assert/strict'
import { chain, tokens } from './helpers.js'
import { balanceOf, burn, mint, move, resolveTransfer, transfer } from '../src/core/token.js'
import { TOTAL_SUPPLY } from '../src/core/constants.js'
import { init } from '../src/core/admin.js'

test('init mints the full supply to the owner', () => {
  const { as } = chain()
  const g = as('x', 0)
  assert.equal(balanceOf(g, 'owner.testnet'), TOTAL_SUPPLY)
  assert.equal(g.meta().total_supply, TOTAL_SUPPLY)
  assert.equal(g.meta().burned, 0n)
})

test('init cannot run twice', () => {
  const { as } = chain()
  assert.throws(() => init(as('owner.testnet'), { owner_id: 'x' }), /already initialised/)
})

test('transfer moves tokens and rejects overdrafts', () => {
  const { as } = chain()
  const g = as('owner.testnet')
  transfer(g, 'owner.testnet', 'ana.testnet', tokens(100))
  assert.equal(balanceOf(g, 'ana.testnet'), tokens(100))
  assert.throws(() => transfer(g, 'ana.testnet', 'bob.testnet', tokens(101)), /insufficient/)
  assert.throws(() => transfer(g, 'ana.testnet', 'ana.testnet', 1n), /differ/)
  assert.throws(() => transfer(g, 'ana.testnet', 'bob.testnet', 0n), /positive/)
})

test('burn shrinks total supply and counts toward burned', () => {
  const { as } = chain()
  const g = as('owner.testnet')
  burn(g, 'owner.testnet', tokens(1000), 'test')
  assert.equal(g.meta().total_supply, TOTAL_SUPPLY - tokens(1000))
  assert.equal(g.meta().burned, tokens(1000))
  assert.equal(g.recentEvents(5)[0].k, 'BURN')
})

test('zero balances are removed from storage', () => {
  const { as, data } = chain()
  const g = as('owner.testnet')
  transfer(g, 'owner.testnet', 'ana.testnet', 5n)
  move(g, 'ana.testnet', 'owner.testnet', 5n)
  assert.equal(data.has('b:ana.testnet'), false)
})

test('resolveTransfer refunds whatever the receiver did not use', () => {
  const { as } = chain()
  const g = as('owner.testnet')
  transfer(g, 'owner.testnet', 'dex.testnet', tokens(10))
  assert.equal(resolveTransfer(g, 'owner.testnet', 'dex.testnet', tokens(10), `"${tokens(4)}"`), tokens(6))
  assert.equal(balanceOf(g, 'dex.testnet'), tokens(6))
  // receiver call failed: everything comes back
  assert.equal(resolveTransfer(g, 'owner.testnet', 'dex.testnet', tokens(6), null), 0n)
  assert.equal(balanceOf(g, 'dex.testnet'), 0n)
})

test('mint is internal-only and updates supply', () => {
  const { as } = chain()
  const g = as('owner.testnet')
  mint(g, 'ana.testnet', 7n)
  assert.equal(g.meta().total_supply, TOTAL_SUPPLY + 7n)
})
