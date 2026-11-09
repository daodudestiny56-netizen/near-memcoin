import { DECIMALS } from './constants.js'
import { heartbeat, splitsFor } from './heartbeat.js'
import { balanceOf } from './token.js'
import { getStats } from './players.js'
import { entries, getQuest, phaseOf, summary } from './quests.js'

// Everything the dashboard needs in one read. Never writes, so it is safe in views.
export function overview(g) {
  const meta = g.meta()
  const hb = heartbeat(g)
  const treasury = balanceOf(g, meta.owner)
  const contractBalance = balanceOf(g, g.ctx.self)
  const [burn_bps, rollover_bps, voters_bps] = splitsFor(hb.mood)
  return {
    total_supply: meta.total_supply,
    burned: meta.burned,
    rollover: meta.rollover,
    treasury,
    escrowed: contractBalance - meta.rollover,
    circulating: meta.total_supply - treasury - contractBalance,
    quests_created: meta.next_quest - 1,
    quests_completed: meta.completed,
    mood: hb.mood,
    epoch: hb.epoch,
    pulse: hb.pulse,
    target_pulse: g.cfg().target_pulse,
    history: hb.history,
    splits: { burn_bps, rollover_bps, voters_bps },
    faucet_on: meta.faucet_on,
    decimals: DECIMALS,
  }
}

export function questDetail(g, id) {
  const quest = getQuest(g, id)
  return { ...summary(g, quest), phase: phaseOf(quest, g.ctx.now), entries: entries(g, id) }
}

export function player(g, account) {
  const stats = getStats(g, account)
  const hb = heartbeat(g)
  return {
    account,
    balance: balanceOf(g, account),
    ...stats,
    gm_available: stats.last_gm_epoch !== hb.epoch,
    streak_alive: stats.last_gm_epoch >= hb.epoch - 1,
    starvable:
      hb.mood === 'STARVING' &&
      stats.last_active_epoch <= hb.epoch - g.cfg().starve_idle_epochs &&
      stats.last_starved_epoch < hb.epoch,
  }
}

export function config(g) {
  return g.cfg()
}
