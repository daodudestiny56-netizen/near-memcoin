import { TOTAL_SUPPLY } from './constants.js'
import { req } from './codec.js'
import { mint } from './token.js'
import { epochOf } from './heartbeat.js'

// Owner powers are deliberately thin: no mint, no pause, no way to touch escrow
// or the failed-stake splits. The owner can only tune clocks and thresholds.
const TUNABLE = [
  'epoch_s', 'target_pulse', 'min_phase_s', 'propose_streak', 'propose_burn',
  'starve_bps', 'starve_min', 'starve_idle_epochs', 'claim_amount',
]

export function init(g, { owner_id, faucet_on = false, config = {} }) {
  req(g.store.get('m') === null, 'already initialised')
  req(typeof owner_id === 'string' && owner_id.length > 0, 'owner_id required')
  g.write('m', {
    owner: owner_id, total_supply: 0n, burned: 0n, rollover: 0n,
    next_quest: 1, completed: 0, ev_seq: 0, faucet_on: !!faucet_on, exempt: [owner_id],
  })
  g.write('cfg', pickTunable(config))
  mint(g, owner_id, TOTAL_SUPPLY)
  g.write('hb', { epoch: epochOf(g.ctx.now, g.cfg()), pulse: 0, mood: 'STEADY', history: [] })
}

function pickTunable(input) {
  const out = {}
  for (const key of TUNABLE) {
    if (input[key] === undefined) continue
    req(Number.isInteger(input[key]) && input[key] >= 0, `${key} must be a non-negative integer`)
    out[key] = input[key]
  }
  return out
}

export function onlyOwner(g) {
  req(g.ctx.caller === g.meta().owner, 'owner only')
}

export function setConfig(g, config) {
  onlyOwner(g)
  g.update('cfg', (c) => Object.assign(c, pickTunable(config)), {})
}

export function setExempt(g, account, exempt) {
  onlyOwner(g)
  g.update('m', (m) => {
    m.exempt = m.exempt.filter((a) => a !== account)
    if (exempt) m.exempt.push(account)
  })
}

export function setFaucet(g, on) {
  onlyOwner(g)
  g.update('m', (m) => {
    m.faucet_on = !!on
  })
}
