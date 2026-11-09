import { REGISTRY_MAX } from './constants.js'
import { req } from './codec.js'
import { balanceOf, move } from './token.js'
import { heartbeat, pulse, tick } from './heartbeat.js'

const FRESH = {
  xp: 0, wins: 0, scars: 0, quests: 0, votes_correct: 0,
  streak: 0, best_streak: 0,
  last_gm_epoch: -1, last_active_epoch: -1, last_starved_epoch: -1,
  registered: false,
}

export function getStats(g, account) {
  return { ...FRESH, ...(g.read(`s:${account}`) || {}) }
}

// Edit a player's record. Players with xp are indexed for the leaderboard.
export function updateStats(g, account, fn) {
  const stats = getStats(g, account)
  fn(stats)
  if (!stats.registered && stats.xp > 0) {
    const registry = g.read('accts', [])
    if (registry.length < REGISTRY_MAX) {
      registry.push(account)
      g.write('accts', registry)
      stats.registered = true
    }
  }
  g.write(`s:${account}`, stats)
  return stats
}

// Mark the caller as active this epoch (protects them from starvation).
export function touch(g, account) {
  const epoch = tick(g).epoch
  updateStats(g, account, (s) => {
    s.last_active_epoch = epoch
  })
}

// Scars are earned by losing a quest. They add a little voting weight.
export function voteWeight(stats) {
  return 1 + Math.min(stats.scars, 3)
}

// Daily ritual: one gm per epoch. Consecutive epochs build a streak, which
// unlocks proposing quests. Missing an epoch resets it to 1.
export function gm(g) {
  const who = g.ctx.caller
  const epoch = tick(g).epoch
  const stats = getStats(g, who)
  req(stats.last_gm_epoch !== epoch, 'already said gm this epoch')
  pulse(g, 1)
  const streak = stats.last_gm_epoch === epoch - 1 ? stats.streak + 1 : 1
  updateStats(g, who, (s) => {
    s.streak = streak
    s.best_streak = Math.max(s.best_streak, streak)
    s.last_gm_epoch = epoch
    s.last_active_epoch = epoch
    s.xp += 5
  })
  g.emit('GM', { account: who, streak })
  return streak
}

// Demo faucet: one claim per account from the owner's treasury balance.
export function claim(g) {
  const who = g.ctx.caller
  const meta = g.meta()
  req(meta.faucet_on, 'faucet is off')
  req(g.read(`c:${who}`) === null, 'already claimed')
  const amount = BigInt(g.cfg().claim_amount) * 10n ** 18n
  req(balanceOf(g, meta.owner) >= amount, 'faucet is empty')
  g.write(`c:${who}`, true)
  move(g, meta.owner, who, amount)
  g.emit('CLAIM', { account: who, amount })
  return amount
}

export function leaderboard(g, limit = 10) {
  const registry = g.read('accts', [])
  return registry
    .map((account) => ({ account, ...getStats(g, account) }))
    .sort((a, b) => b.xp - a.xp || b.wins - a.wins)
    .slice(0, Math.min(limit, 50))
    .map(({ account, xp, wins, scars, quests, streak, best_streak, votes_correct }) => ({
      account, xp, wins, scars, quests, streak, best_streak, votes_correct,
    }))
}

export function epochNow(g) {
  return heartbeat(g).epoch
}
