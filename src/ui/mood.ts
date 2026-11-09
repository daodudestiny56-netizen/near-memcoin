import type { Mood } from '../chain/types'

export interface MoodInfo {
  label: string
  color: string
  line: string
  effect: string
}

export const MOODS: Record<Mood, MoodInfo> = {
  THRIVING: {
    label: 'Thriving',
    color: 'var(--thriving)',
    line: 'The community is buzzing. MIRA is feeding well.',
    effect: 'Burns harder: 60% of every failed stake is destroyed.',
  },
  STEADY: {
    label: 'Steady',
    color: 'var(--steady)',
    line: 'A healthy pulse. MIRA is content.',
    effect: 'Balanced: half of every failed stake burns, the rest feeds quests and voters.',
  },
  HUNGRY: {
    label: 'Hungry',
    color: 'var(--hungry)',
    line: 'Activity is slipping. MIRA wants quests.',
    effect: 'Burns ease to 35% and more flows into the next quest pool.',
  },
  STARVING: {
    label: 'Starving',
    color: 'var(--starving)',
    line: 'Nobody showed up. MIRA is starving.',
    effect: 'Only 20% burns; keepers may tax idle holders 1% to feed the pool.',
  },
}

export const EVENT_LABEL: Record<string, string> = {
  BURN: 'Burned',
  GM: 'gm',
  CLAIM: 'Faucet claim',
  QUEST_PROPOSED: 'Quest proposed',
  JOINED: 'Joined quest',
  PROOF: 'Proof submitted',
  VOTE_COMMITTED: 'Sealed a vote',
  VOTE_REVEALED: 'Revealed a vote',
  QUEST_RESOLVED: 'Quest settled',
  QUEST_VOID: 'Quest voided',
  STARVE: 'Starvation tax',
}
