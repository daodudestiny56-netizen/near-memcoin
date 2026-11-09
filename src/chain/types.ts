export type Mood = 'THRIVING' | 'STEADY' | 'HUNGRY' | 'STARVING'
export type Phase = 'SUBMIT' | 'COMMIT' | 'REVEAL' | 'SETTLE' | 'VOID' | 'RESOLVED'

// Amounts are decimal strings in base units (18 decimals); timestamps are ns strings.
export interface HistoryPoint {
  epoch: number
  pulse: number
  mood: Mood
}

export interface Overview {
  total_supply: string
  burned: string
  rollover: string
  treasury: string
  escrowed: string
  circulating: string
  quests_created: number
  quests_completed: number
  mood: Mood
  epoch: number
  pulse: number
  target_pulse: number
  history: HistoryPoint[]
  splits: { burn_bps: number; rollover_bps: number; voters_bps: number }
  faucet_on: boolean
  decimals: number
}

export interface Config {
  epoch_s: number
  target_pulse: number
  min_phase_s: number
  max_phase_s: number
  propose_streak: number
  propose_burn: number
  min_stake: number
  min_entrants: number
  starve_bps: number
  starve_min: number
  starve_idle_epochs: number
  claim_amount: number
}

export interface QuestResult {
  winners?: string[]
  burned?: string
  rolled_over?: string
  voter_pot?: string
  correct_voters?: number
  mood?: Mood
  reason?: string
}

export interface Quest {
  id: number
  proposer: string
  title: string
  description: string
  stake: string
  vote_stake: string
  pool: string
  status: 'ACTIVE' | 'VOID' | 'RESOLVED'
  submit_end: string
  commit_end: string
  reveal_end: string
  entrants: number
  voters: number
  result: QuestResult | null
  phase: Phase
}

export interface QuestDetail extends Quest {
  entries: { account: string; proof: string | null; tally: number }[]
  votes: { account: string; revealed: boolean }[]
}

export interface Player {
  account: string
  balance: string
  xp: number
  wins: number
  scars: number
  quests: number
  votes_correct: number
  streak: number
  best_streak: number
  last_gm_epoch: number
  last_active_epoch: number
  gm_available: boolean
  streak_alive: boolean
  starvable: boolean
}

export interface LeaderRow {
  account: string
  xp: number
  wins: number
  scars: number
  quests: number
  streak: number
  best_streak: number
  votes_correct: number
}

export interface FeedEvent {
  i: number
  t: string
  k: string
  d: Record<string, unknown>
}
