import { ONE, STARVE_BOUNTY_BPS } from './constants.js'
import { req } from './codec.js'
import { balanceOf, move } from './token.js'
import { tick } from './heartbeat.js'
import { getStats, updateStats } from './players.js'

// When the community goes quiet the coin starves. Anyone may then "feed" the
// pool by taxing a long-idle holder: a small slice of their balance moves to the
// next quest's rollover, and the caller keeps a bounty. Active players, the
// treasury and exempt accounts (DEX pools, the contract) are never touched.
export function starve(g, target) {
  const cfg = g.cfg()
  const caller = g.ctx.caller
  const hb = tick(g)
  req(hb.mood === 'STARVING', `MIRA is ${hb.mood}, not starving`)
  req(target !== caller, 'cannot starve yourself')
  req(target !== g.ctx.self && !g.meta().exempt.includes(target), 'account is exempt')

  const stats = getStats(g, target)
  req(stats.last_active_epoch <= hb.epoch - cfg.starve_idle_epochs, 'account was active recently')
  req(stats.last_starved_epoch < hb.epoch, 'already starved this epoch')

  const balance = balanceOf(g, target)
  req(balance >= BigInt(cfg.starve_min) * ONE, 'balance too small to starve')
  const take = (balance * BigInt(cfg.starve_bps)) / 10000n
  const bounty = (take * BigInt(STARVE_BOUNTY_BPS)) / 10000n
  const toPool = take - bounty

  move(g, target, g.ctx.self, toPool)
  move(g, target, caller, bounty)
  g.update('m', (m) => {
    m.rollover += toPool
  })
  updateStats(g, target, (s) => {
    s.last_starved_epoch = hb.epoch
  })
  g.emit('STARVE', { account: target, taken: take, to_pool: toPool, bounty, keeper: caller })
  return { taken: take, to_pool: toPool, bounty }
}
