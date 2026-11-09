import { HISTORY_MAX, NS, SPLITS } from './constants.js'

export const MOODS = ['THRIVING', 'STEADY', 'HUNGRY', 'STARVING']

// "Pulse" = on-chain actions in an epoch (joins, votes, gm, proposals, settlements).
export function moodFor(pulse, target) {
  if (pulse * 2 >= target * 3) return 'THRIVING'
  if (pulse >= target) return 'STEADY'
  if (pulse * 2 >= target) return 'HUNGRY'
  return 'STARVING'
}

export function epochOf(now, cfg) {
  return Number(now / (BigInt(cfg.epoch_s) * NS))
}

// Pure: returns the heartbeat as of `epoch` without writing anything, so view
// calls can show the live mood. Silent epochs count as zero pulse = STARVING.
export function advance(hb, epoch, cfg) {
  if (epoch <= hb.epoch) return hb
  const finished = { epoch: hb.epoch, pulse: hb.pulse, mood: moodFor(hb.pulse, cfg.target_pulse) }
  const history = hb.history.concat(finished)
  const silent = epoch - hb.epoch - 1
  for (let i = Math.min(silent, HISTORY_MAX); i > 0; i--) {
    history.push({ epoch: epoch - i, pulse: 0, mood: 'STARVING' })
  }
  return {
    epoch,
    pulse: 0,
    mood: silent > 0 ? 'STARVING' : finished.mood,
    history: history.slice(-HISTORY_MAX),
  }
}

export function heartbeat(g) {
  return advance(g.read('hb'), epochOf(g.ctx.now, g.cfg()), g.cfg())
}

// Persist the clock (state-changing calls only).
export function tick(g) {
  const hb = heartbeat(g)
  g.write('hb', hb)
  return hb
}

// Count community activity toward the current epoch.
export function pulse(g, amount = 1) {
  const hb = tick(g)
  hb.pulse += amount
  g.write('hb', hb)
  return hb
}

export function splitsFor(mood) {
  return SPLITS[mood]
}
