export const DECIMALS = 18
export const ONE = 10n ** 18n
export const TOTAL_SUPPLY = 10_000_000n * ONE
export const NS = 1_000_000_000n

// Owner-tunable knobs (seconds / counts / whole-token amounts as numbers).
// Economic splits below are NOT configurable: nobody can change them after deploy.
export const DEFAULT_CONFIG = {
  epoch_s: 86_400,
  target_pulse: 20,
  min_phase_s: 60,
  max_phase_s: 1_209_600,
  propose_streak: 3,
  propose_burn: 50,
  min_stake: 1,
  min_entrants: 2,
  max_entrants: 30,
  max_voters: 60,
  starve_bps: 100,
  starve_min: 10,
  starve_idle_epochs: 2,
  claim_amount: 1000,
}

// [burn, rollover, correct-voters] in basis points of every failed stake.
// A healthy community burns harder; a starving one feeds the next quest.
export const SPLITS = {
  THRIVING: [6000, 2000, 2000],
  STEADY: [5000, 3000, 2000],
  HUNGRY: [3500, 4500, 2000],
  STARVING: [2000, 6000, 2000],
}

export const STARVE_BOUNTY_BPS = 2000
export const HISTORY_MAX = 14
export const EVENT_KEEP = 100
export const REGISTRY_MAX = 1000
