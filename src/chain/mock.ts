// Development-only fake chain (VITE_MOCK=1). Lets the UI be built and screenshotted
// without a deployed contract. Never included in production builds.
const U = 10n ** 18n
const tok = (n: number) => (BigInt(Math.round(n * 100)) * U / 100n).toString()
const ns = (ms: number) => (BigInt(Math.round(ms)) * 1_000_000n).toString()
const now = () => Date.now()
const min = 60_000

let streak = 2
let gmAvailable = true
let balance = 1000
let claimed = false
const myVotes = new Set<number>()
let pulse = 23
let burned = 412_850

const base = now()
const quests = [
  {
    id: 4, proposer: 'sunny.testnet', title: 'Meme the market',
    description: 'Explain today’s market move in one meme. Clarity wins, doomposting burns.',
    stake: tok(10), vote_stake: tok(2), pool: tok(640), status: 'ACTIVE',
    submit_end: ns(base - 5 * min), commit_end: ns(base + 6 * min), reveal_end: ns(base + 14 * min),
    entrants: 5, voters: 3, result: null, phase: 'COMMIT',
    entries: [
      { account: 'kaito.near', proof: 'https://x.com/kaito/status/1', tally: 0 },
      { account: 'mira-fan.testnet', proof: 'https://x.com/mirafan/status/2', tally: 0 },
      { account: 'ola.testnet', proof: 'ipfs://bafy…meme', tally: 0 },
      { account: 'dee.testnet', proof: 'https://imgur.com/abc', tally: 0 },
      { account: 'zed.testnet', proof: null, tally: 0 },
    ],
    votes: [{ account: 'a.testnet', revealed: false }, { account: 'b.testnet', revealed: false }, { account: 'c.testnet', revealed: false }],
  },
  {
    id: 3, proposer: 'kaito.near', title: 'Touch grass',
    description: 'Post a photo from your local park. The community votes on the most wholesome proof.',
    stake: tok(25), vote_stake: tok(5), pool: tok(1250), status: 'ACTIVE',
    submit_end: ns(base + 22 * min), commit_end: ns(base + 40 * min), reveal_end: ns(base + 55 * min),
    entrants: 2, voters: 0, result: null, phase: 'SUBMIT',
    entries: [
      { account: 'kaito.near', proof: 'https://photos.app/park1', tally: 0 },
      { account: 'ola.testnet', proof: null, tally: 0 },
    ],
    votes: [],
  },
  {
    id: 2, proposer: 'sunny.testnet', title: 'Bring one friend',
    description: 'Introduce a new builder to MIRA and help them complete their first quest.',
    stake: tok(5), vote_stake: tok(1), pool: tok(300), status: 'RESOLVED',
    submit_end: ns(base - 80 * min), commit_end: ns(base - 60 * min), reveal_end: ns(base - 40 * min),
    entrants: 7, voters: 9,
    result: { winners: ['ola.testnet', 'kaito.near'], burned: tok(8.75), rolled_over: tok(5.25), voter_pot: tok(7), correct_voters: 5, mood: 'STEADY' },
    phase: 'RESOLVED',
    entries: [
      { account: 'ola.testnet', proof: 'https://x.com/ola/1', tally: 6 },
      { account: 'kaito.near', proof: 'https://x.com/kaito/9', tally: 4 },
    ],
    votes: [],
  },
]

const events = () => [
  { i: 9, t: ns(now() - 20_000), k: 'VOTE_COMMITTED', d: { id: 4, account: 'c.testnet' } },
  { i: 8, t: ns(now() - 95_000), k: 'BURN', d: { amount: tok(8.75), reason: 'failed_stakes' } },
  { i: 7, t: ns(now() - 96_000), k: 'QUEST_RESOLVED', d: { id: 2, winners: ['ola.testnet', 'kaito.near'] } },
  { i: 6, t: ns(now() - 3 * min), k: 'GM', d: { account: 'sunny.testnet', streak: 5 } },
  { i: 5, t: ns(now() - 6 * min), k: 'STARVE', d: { account: 'zed.testnet', taken: tok(10), to_pool: tok(8), bounty: tok(2), keeper: 'ola.testnet' } },
  { i: 4, t: ns(now() - 9 * min), k: 'BURN', d: { amount: tok(50), reason: 'propose' } },
  { i: 3, t: ns(now() - 9 * min), k: 'QUEST_PROPOSED', d: { id: 4, proposer: 'sunny.testnet', title: 'Meme the market', pool: tok(640) } },
  { i: 2, t: ns(now() - 14 * min), k: 'JOINED', d: { id: 3, account: 'ola.testnet', stake: tok(25) } },
]

export async function mockView(method: string, args: Record<string, unknown>): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 60))
  switch (method) {
    case 'get_dashboard': {
      const [overview, list, evs, board, me] = await Promise.all([
        mockView('get_overview', {}), mockView('list_quests', {}), mockView('recent_events', {}),
        mockView('get_leaderboard', {}), args.account_id ? mockView('get_player', { account_id: args.account_id }) : null,
      ])
      return { overview, quests: (list as { id: number }[]).map((q) => quests.find((x) => x.id === q.id)), events: evs, board, player: me }
    }
    case 'get_overview':
      return {
        total_supply: tok(10_000_000 - burned), burned: tok(burned), rollover: tok(212), treasury: tok(8_204_100),
        escrowed: tok(1912), circulating: tok(1_791_000), quests_created: 4, quests_completed: 1,
        mood: pulse >= 30 ? 'THRIVING' : pulse >= 20 ? 'STEADY' : pulse >= 10 ? 'HUNGRY' : 'STARVING',
        epoch: 24, pulse, target_pulse: 20,
        history: [14, 9, 6, 11, 18, 22, 27, 31, 24, 17, 12, 19, 26, 33].map((p, i) => ({
          epoch: 10 + i, pulse: p, mood: p >= 30 ? 'THRIVING' : p >= 20 ? 'STEADY' : p >= 10 ? 'HUNGRY' : 'STARVING',
        })),
        splits: pulse >= 30 ? { burn_bps: 6000, rollover_bps: 2000, voters_bps: 2000 } : { burn_bps: 5000, rollover_bps: 3000, voters_bps: 2000 },
        faucet_on: true, decimals: 18,
      }
    case 'get_config':
      return { epoch_s: 3600, target_pulse: 20, min_phase_s: 60, max_phase_s: 1_209_600, propose_streak: 3, propose_burn: 50, min_stake: 1, min_entrants: 2, starve_bps: 100, starve_min: 10, starve_idle_epochs: 2, claim_amount: 1000 }
    case 'list_quests':
      return quests.map(({ entries: _e, votes: _v, ...q }) => q)
    case 'get_quest':
      return quests.find((q) => q.id === args.id)
    case 'recent_events':
      return events()
    case 'get_leaderboard':
      return [
        { account: 'kaito.near', xp: 12480, wins: 14, scars: 2, quests: 42, streak: 21, best_streak: 21, votes_correct: 30 },
        { account: 'sunny.testnet', xp: 10920, wins: 11, scars: 4, quests: 37, streak: 9, best_streak: 14, votes_correct: 22 },
        { account: 'ola.testnet', xp: 8410, wins: 8, scars: 1, quests: 29, streak: 5, best_streak: 12, votes_correct: 19 },
        { account: 'dee.testnet', xp: 5120, wins: 3, scars: 6, quests: 24, streak: 0, best_streak: 7, votes_correct: 11 },
      ]
    case 'get_player':
      return {
        account: args.account_id, balance: tok(balance), xp: 140, wins: 1, scars: 1, quests: 3, votes_correct: 2,
        streak, best_streak: 4, last_gm_epoch: gmAvailable ? 23 : 24, last_active_epoch: 24,
        gm_available: gmAvailable, streak_alive: true, starvable: false,
      }
  }
  throw new Error(`mock: unknown view ${method}`)
}

export async function mockCall(method: string, args: Record<string, unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 700))
  if (method === 'gm') { streak += 1; gmAvailable = false; pulse += 1 }
  if (method === 'claim') { if (claimed) throw new Error('already claimed'); claimed = true; balance += 1000 }
  if (method === 'commit_vote') myVotes.add(Number(args.id))
  if (method === 'propose_quest') burned += 50
}
