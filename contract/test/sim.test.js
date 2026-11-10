import test from 'node:test'
import assert from 'node:assert/strict'
import { SCENARIOS, runScenario } from '../sim/engine.js'

// runScenario throws if the sum of all balances ever differs from total supply, so a pass here
// also proves conservation across quests, burns, voids and the starvation tax.
test('the simulation runs every scenario and conserves supply', () => {
  for (const sc of SCENARIOS) {
    const r = runScenario(sc, { days: 12, quiet: true })
    assert.equal(r.series.length, 12)
    assert.ok(r.circulatingEnd <= r.circulatingStart + 1e-9, `${sc.key}: nothing mints, so circulating cannot grow`)
  }
})

test('the simulation is deterministic for a given seed', () => {
  const a = runScenario(SCENARIOS[0], { days: 10, quiet: true })
  const b = runScenario(SCENARIOS[0], { days: 10, quiet: true })
  assert.deepEqual(a.series, b.series)
})

test('a thriving community burns more than a quiet one', () => {
  const [thriving, , quiet] = SCENARIOS.map((sc) => runScenario(sc, { days: 30, quiet: true }))
  assert.ok(thriving.burned > quiet.burned)
})
