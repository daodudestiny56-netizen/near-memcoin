// A 60-day population simulation that drives the REAL contract rules (src/core), not a model of them.
// Each simulated player is a transaction sender on an in-memory chain; every call below is the same
// function the deployed contract runs. Nothing here is tuned to flatter the mechanic: the scenarios
// are plain activity levels, and the sybil ring is deliberately the strongest cheap attack.
import { chain, sha256Hex, tokens } from '../test/helpers.js'
import { ONE } from '../src/core/constants.js'
import { claim, gm, getStats } from '../src/core/players.js'
import { balanceOf } from '../src/core/token.js'
import { propose, join, submitProof, entries } from '../src/core/quests.js'
import { commitPreimage, commitVote, revealVote, resolve } from '../src/core/settle.js'
import { starve } from '../src/core/starve.js'
import { overview } from '../src/core/views.js'

const H = 3_600
const DAY = 86_400
const SALT = 'sim'

// Deterministic, so a reader gets the same numbers: same seed, same run.
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// `activity(day)` is the chance that a given player shows up that day.
export const SCENARIOS = [
  { key: 'thriving', label: 'Thriving', note: '30 players, 70% show up daily', players: 30, activity: () => 0.7 },
  { key: 'fading', label: 'Fading', note: '30 players, attendance falls from 75% to 10%', players: 30, activity: (d) => 0.75 - (0.65 * d) / 59 },
  { key: 'quiet', label: 'Quiet', note: '30 players, 6% show up daily', players: 30, activity: () => 0.06 },
  { key: 'sybil', label: 'Sybil ring', note: '30 players at 50% plus 12 colluding accounts', players: 30, activity: () => 0.5, ring: 12 },
]

const tok = (wei) => Number((wei * 100n) / ONE) / 100

export function runScenario(scenario, { days = 60, seed = 7, config = {}, quiet = false } = {}) {
  const rnd = mulberry32(seed)
  const c = chain({ config })
  const honest = Array.from({ length: scenario.players }, (_, i) => `p${i}.testnet`)
  const ring = Array.from({ length: scenario.ring ?? 0 }, (_, i) => `s${i}.testnet`)
  const everyone = [...honest, ...ring]
  const keeper = 'keeper.testnet'
  const rejections = {}
  const attempt = (fn) => {
    try {
      return fn()
    } catch (e) {
      const key = String(e.message).replace(/\d+/g, 'N')
      rejections[key] = (rejections[key] ?? 0) + 1
      return undefined
    }
  }

  // Everyone, including the sybils, takes the demo faucet once: the same 1,000 MIRA the testnet gives.
  for (const who of everyone) claim(c.as(who, 1))
  const startBalance = (accounts) => accounts.reduce((sum, a) => sum + balanceOf(c.as(a, 1), a), 0n)
  const honestStart = startBalance(honest)
  const ringStart = startBalance(ring)

  const series = []
  const moodDays = { THRIVING: 0, STEADY: 0, HUNGRY: 0, STARVING: 0 }
  const tally = { settled: 0, voided: 0, wins: 0, ringWins: 0, ringEntries: 0, entries: 0, starves: 0, taxed: 0n, burnedBySettle: 0n }
  let pending = null

  for (let d = 0; d < days; d++) {
    const B = d * DAY
    const chance = scenario.activity(d)
    const active = new Set(honest.filter(() => rnd() < chance))
    for (const r of ring) active.add(r)

    // 1. settle yesterday's quest (anyone can; here a keeper does)
    if (pending !== null) {
      const result = attempt(() => resolve(c.as(keeper, B + 60), pending))
      if (result?.winners) {
        tally.settled += 1
        tally.wins += result.winners.length
        tally.ringWins += result.winners.filter((w) => w.startsWith('s')).length
        tally.burnedBySettle += BigInt(result.burned)
      } else if (result) tally.voided += 1
      pending = null
    }

    // 2. the daily ritual
    for (const who of active) attempt(() => gm(c.as(who, B + 10)))

    // 3. a player with a streak proposes a quest: burn 50, seed 10 into the pool, 23h in three phases
    const proposers = honest.filter((p) => active.has(p) && getStats(c.as(p, B + 70), p).streak >= 3 && balanceOf(c.as(p, B + 70), p) >= tokens(120))
    if (proposers.length) {
      const who = proposers[Math.floor(rnd() * proposers.length)]
      pending = attempt(() => propose(c.as(who, B + 70), {
        title: `Quest ${d + 1}`, description: '', stake: tokens(20), seed: tokens(10),
        submit_s: 8 * H, commit_s: 8 * H, reveal_s: 7 * H,
      })) ?? null
    }

    if (pending !== null) {
      // 4. entries with proof
      for (const who of everyone) {
        if (!active.has(who)) continue
        if (!ring.includes(who) && rnd() >= 0.4) continue
        const joined = attempt(() => {
          join(c.as(who, B + H), pending)
          return true
        })
        if (joined) {
          attempt(() => submitProof(c.as(who, B + H + 5), pending, `proof by ${who}`))
          tally.entries += 1
          if (ring.includes(who)) tally.ringEntries += 1
        }
      }

      // 5. sealed votes. Honest voters pick someone else at random; the ring votes round-robin for itself.
      const withProof = entries(c.as('x', B + 9 * H), pending).filter((e) => e.proof).map((e) => e.account)
      const picks = []
      for (const who of everyone) {
        if (!active.has(who)) continue
        const isRing = ring.includes(who)
        if (!isRing && rnd() >= 0.6) continue
        const pool = isRing ? ring.filter((r) => r !== who && withProof.includes(r)) : withProof.filter((a) => a !== who)
        if (!pool.length) continue
        const entrant = isRing ? pool[(ring.indexOf(who) + 1) % pool.length] : pool[Math.floor(rnd() * pool.length)]
        const ok = attempt(() => {
          commitVote(c.as(who, B + 9 * H), pending, sha256Hex(commitPreimage(pending, who, entrant, SALT)))
          return true
        })
        if (ok) picks.push({ who, entrant, isRing })
      }

      // 6. reveals (honest voters forget 5% of the time and forfeit their vote stake)
      for (const p of picks) {
        if (!p.isRing && rnd() < 0.05) continue
        attempt(() => revealVote(c.as(p.who, B + 17 * H), pending, p.entrant, SALT))
      }
    }

    // 7. a keeper bot taxes idle holders whenever the coin is starving
    for (const target of everyone) {
      const r = attempt(() => starve(c.as(keeper, B + 23 * H), target))
      if (r) {
        tally.starves += 1
        tally.taxed += BigInt(r.taken)
      }
    }

    const o = overview(c.as('x', B + DAY - 5))
    moodDays[o.mood] += 1
    series.push({
      day: d + 1,
      mood: o.mood,
      supply: tok(BigInt(o.total_supply)),
      circulating: tok(BigInt(o.circulating)),
      burned: tok(BigInt(o.burned)),
      rollover: tok(BigInt(o.rollover)),
      escrowed: tok(BigInt(o.escrowed)),
      active: active.size,
    })
  }

  // Conservation: every token is in exactly one place.
  const end = days * DAY
  const holders = [...everyone, keeper, 'owner.testnet', c.self]
  const held = holders.reduce((sum, a) => sum + balanceOf(c.as(a, end), a), 0n)
  const final = overview(c.as('x', end))
  if (held !== BigInt(final.total_supply)) throw new Error(`conservation broken in ${scenario.key}: ${held} != ${final.total_supply}`)

  const endBalance = (accounts) => accounts.reduce((sum, a) => sum + balanceOf(c.as(a, end), a), 0n)
  const result = {
    key: scenario.key, label: scenario.label, note: scenario.note, days, seed, series, moodDays, rejections,
    settled: tally.settled, voided: tally.voided,
    burned: tok(BigInt(final.burned)),
    burnedByFailedStakes: tok(tally.burnedBySettle),
    burnedByProposals: tok(BigInt(final.burned) - tally.burnedBySettle),
    circulatingStart: series[0].circulating,
    circulatingEnd: series[series.length - 1].circulating,
    rolloverEnd: tok(BigInt(final.rollover)),
    starveEvents: tally.starves,
    keeperEarned: tok(balanceOf(c.as(keeper, end), keeper)),
    honestChange: tok(endBalance(honest) - honestStart),
    honestPlayers: honest.length,
  }
  if (ring.length) {
    result.ring = {
      accounts: ring.length,
      change: tok(endBalance(ring) - ringStart),
      winShare: tally.wins ? tally.ringWins / tally.wins : 0,
      entryShare: tally.entries ? tally.ringEntries / tally.entries : 0,
    }
  }
  if (!quiet) console.log(`${scenario.key}: ${result.settled} settled, ${result.voided} void, burned ${result.burned}`)
  return result
}
