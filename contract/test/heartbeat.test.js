import test from 'node:test'
import assert from 'node:assert/strict'
import { chain } from './helpers.js'
import { advance, heartbeat, moodFor, pulse, tick } from '../src/core/heartbeat.js'

const DAY = 86_400

test('mood thresholds follow the target pulse', () => {
  assert.equal(moodFor(30, 20), 'THRIVING')
  assert.equal(moodFor(29, 20), 'STEADY')
  assert.equal(moodFor(20, 20), 'STEADY')
  assert.equal(moodFor(19, 20), 'HUNGRY')
  assert.equal(moodFor(10, 20), 'HUNGRY')
  assert.equal(moodFor(9, 20), 'STARVING')
})

test('a new chain starts STEADY in its first epoch', () => {
  const { as } = chain()
  assert.equal(heartbeat(as('x', 10)).mood, 'STEADY')
})

test('pulse accumulates within an epoch', () => {
  const { as } = chain()
  pulse(as('x', 10), 3)
  pulse(as('x', 20), 2)
  assert.equal(heartbeat(as('x', 30)).pulse, 5)
})

test('crossing an epoch boundary settles the mood from the finished epoch', () => {
  const { as } = chain({ config: { target_pulse: 4 } })
  pulse(as('x', 10), 6) // 6 >= 1.5 * 4
  const hb = tick(as('x', DAY + 5))
  assert.equal(hb.mood, 'THRIVING')
  assert.equal(hb.epoch, 1)
  assert.equal(hb.pulse, 0)
  assert.deepEqual(hb.history.at(-1), { epoch: 0, pulse: 6, mood: 'THRIVING' })
})

test('silent epochs starve the coin', () => {
  const { as } = chain({ config: { target_pulse: 4 } })
  pulse(as('x', 10), 4)
  const hb = tick(as('x', 3 * DAY + 5))
  assert.equal(hb.mood, 'STARVING')
  assert.equal(hb.history.length, 3)
})

test('views see the live mood without writing', () => {
  const { as, store } = chain({ config: { target_pulse: 4 } })
  const before = store.get('hb')
  assert.equal(heartbeat(as('x', 5 * DAY)).mood, 'STARVING')
  assert.equal(store.get('hb'), before)
})

test('advance is a no-op inside the same epoch', () => {
  const hb = { epoch: 3, pulse: 2, mood: 'STEADY', history: [] }
  assert.equal(advance(hb, 3, { target_pulse: 20 }), hb)
})
