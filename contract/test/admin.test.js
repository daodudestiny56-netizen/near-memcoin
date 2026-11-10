import test from 'node:test'
import assert from 'node:assert/strict'
import { chain } from './helpers.js'
import { lockConfig, setConfig, setExempt, setFaucet } from '../src/core/admin.js'
import { overview } from '../src/core/views.js'

test('the owner can tune the config until it is locked', () => {
  const c = chain()
  setConfig(c.as('owner.testnet', 1), { target_pulse: 7 })
  assert.equal(c.as('x', 2).cfg().target_pulse, 7)
  assert.equal(overview(c.as('x', 2)).config_locked, false)
})

test('only the owner can lock, and only once', () => {
  const c = chain()
  assert.throws(() => lockConfig(c.as('ana.testnet', 1)), /owner only/)
  lockConfig(c.as('owner.testnet', 2))
  assert.throws(() => lockConfig(c.as('owner.testnet', 3)), /already locked/)
})

test('after the lock nobody, including the owner, can change the config', () => {
  const c = chain({ config: { target_pulse: 12, propose_burn: 40 } })
  lockConfig(c.as('owner.testnet', 1))
  assert.throws(() => setConfig(c.as('owner.testnet', 2), { target_pulse: 1 }), /locked/)
  assert.throws(() => setConfig(c.as('owner.testnet', 2), { propose_burn: 0 }), /locked/)
  const cfg = c.as('x', 3).cfg()
  assert.equal(cfg.target_pulse, 12)
  assert.equal(cfg.propose_burn, 40)
  assert.equal(overview(c.as('x', 3)).config_locked, true)
})

test('locking is announced as an event with the final config', () => {
  const c = chain({ config: { target_pulse: 12 } })
  lockConfig(c.as('owner.testnet', 1))
  const ev = c.as('x', 2).recentEvents(5).find((e) => e.k === 'CONFIG_LOCKED')
  assert.ok(ev)
  assert.equal(ev.d.config.target_pulse, 12)
})

test('a contract can be launched already locked', () => {
  const c = chain({ config: { target_pulse: 9 }, lock: true })
  assert.equal(overview(c.as('x', 1)).config_locked, true)
  assert.throws(() => setConfig(c.as('owner.testnet', 2), { target_pulse: 1 }), /locked/)
})

test('the lock does not widen or narrow the other owner powers', () => {
  const c = chain()
  lockConfig(c.as('owner.testnet', 1))
  setFaucet(c.as('owner.testnet', 2), false)
  setExempt(c.as('owner.testnet', 3), 'dex.testnet', true)
  assert.equal(overview(c.as('x', 4)).faucet_on, false)
  assert.throws(() => setFaucet(c.as('ana.testnet', 4), true), /owner only/)
})
