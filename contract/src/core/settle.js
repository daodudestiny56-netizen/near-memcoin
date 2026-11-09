import { req } from './codec.js'
import { burn, move } from './token.js'
import { heartbeat, pulse, splitsFor } from './heartbeat.js'
import { getStats, touch, updateStats, voteWeight } from './players.js'
import { eKey, getQuest, qKey, vKey } from './quests.js'

const HEX64 = /^[0-9a-f]{64}$/

// The preimage binds quest, voter, choice and salt, so a commit can't be copied.
export const commitPreimage = (id, voter, entrant, salt) => `${id}:${voter}:${entrant}:${salt}`

// Phase 2: holders stake to cast a hidden vote (sha256 of the preimage).
export function commitVote(g, id, commit) {
  const cfg = g.cfg()
  const who = g.ctx.caller
  const quest = getQuest(g, id)
  req(quest.status === 'ACTIVE', 'quest is closed')
  req(g.ctx.now >= quest.submit_end, 'voting has not started')
  req(g.ctx.now < quest.commit_end, 'voting is closed')
  req(HEX64.test(commit), 'commit must be 64 lowercase hex chars')
  req(!quest.voters.includes(who), 'already voted')
  req(quest.voters.length < cfg.max_voters, 'no more voters allowed')
  move(g, who, g.ctx.self, quest.vote_stake)
  quest.voters.push(who)
  g.write(qKey(id), quest)
  g.write(vKey(id, who), { commit, entrant: null, weight: 0 })
  pulse(g, 1)
  touch(g, who)
  g.emit('VOTE_COMMITTED', { id, account: who })
}

// Phase 3: voters reveal. Wrong preimages and late reveals forfeit the vote stake.
export function revealVote(g, id, entrant, salt) {
  const who = g.ctx.caller
  const quest = getQuest(g, id)
  req(quest.status === 'ACTIVE', 'quest is closed')
  req(g.ctx.now >= quest.commit_end, 'reveal has not started')
  req(g.ctx.now < quest.reveal_end, 'reveal is closed')
  const vote = g.read(vKey(id, who))
  req(vote, 'no vote committed')
  req(vote.entrant === null, 'already revealed')
  req(g.deps.sha256Hex(commitPreimage(id, who, entrant, salt)) === vote.commit, 'reveal does not match commit')
  req(entrant !== who, 'cannot vote for yourself')
  const entry = g.read(eKey(id, entrant))
  req(entry && entry.proof, 'that entrant has no proof')
  const weight = voteWeight(getStats(g, who))
  entry.tally += weight
  g.write(eKey(id, entrant), entry)
  vote.entrant = entrant
  vote.weight = weight
  g.write(vKey(id, who), vote)
  pulse(g, 1)
  touch(g, who)
  g.emit('VOTE_REVEALED', { id, account: who })
}

// Anyone can settle once the reveal window ends.
export function resolve(g, id) {
  const quest = getQuest(g, id)
  req(quest.status === 'ACTIVE', 'already settled')
  req(g.ctx.now >= quest.reveal_end, 'reveal window is still open')
  const cfg = g.cfg()
  const self = g.ctx.self

  const entries = quest.entrants.map((account, order) => ({ account, order, ...g.read(eKey(id, account)) }))
  const votes = quest.voters.map((account) => ({ account, ...g.read(vKey(id, account)) }))
  const totalWeight = entries.reduce((sum, e) => sum + e.tally, 0)

  // Not enough entrants, or nobody revealed a vote: refund everyone, pool rolls over.
  if (entries.length < cfg.min_entrants || totalWeight === 0) {
    for (const e of entries) move(g, self, e.account, quest.stake)
    for (const v of votes) move(g, self, v.account, quest.vote_stake)
    g.update('m', (m) => {
      m.rollover += quest.pool
    })
    quest.status = 'VOID'
    quest.result = { reason: entries.length < cfg.min_entrants ? 'too few entrants' : 'no revealed votes' }
    g.write(qKey(id), quest)
    pulse(g, 1)
    g.emit('QUEST_VOID', { id, reason: quest.result.reason })
    return quest.result
  }

  // Top third of entries (at least one) by weighted votes win; ties go to the earlier joiner.
  const ranked = entries
    .filter((e) => e.proof && e.tally > 0)
    .sort((a, b) => b.tally - a.tally || a.order - b.order)
  const winnerCount = Math.min(ranked.length, Math.max(1, Math.floor(entries.length / 3)))
  const winners = ranked.slice(0, winnerCount)
  const winnerSet = new Set(winners.map((w) => w.account))
  const losers = entries.filter((e) => !winnerSet.has(e.account))

  const share = quest.pool / BigInt(winnerCount)
  const poolDust = quest.pool - share * BigInt(winnerCount)
  for (const w of winners) {
    move(g, self, w.account, quest.stake + share)
    updateStats(g, w.account, (s) => {
      s.wins += 1
      s.quests += 1
      s.xp += 100
    })
  }
  for (const l of losers) {
    updateStats(g, l.account, (s) => {
      s.scars += 1
      s.quests += 1
      s.xp += 10
    })
  }

  // Failed stakes: split by the community's current mood.
  const failed = BigInt(losers.length) * quest.stake
  const [burnBps, rollBps, voterBps] = splitsFor(heartbeat(g).mood)
  const voterCut = (failed * BigInt(voterBps)) / 10000n
  const burnCut = (failed * BigInt(burnBps)) / 10000n
  const rollCut = (failed * BigInt(rollBps)) / 10000n
  let toBurn = burnCut + (failed - voterCut - burnCut - rollCut)

  const correct = votes.filter((v) => v.entrant && winnerSet.has(v.entrant))
  const wrong = votes.length - correct.length
  const voterPot = voterCut + BigInt(wrong) * quest.vote_stake
  if (correct.length > 0) {
    const each = voterPot / BigInt(correct.length)
    toBurn += voterPot - each * BigInt(correct.length)
    for (const v of correct) {
      move(g, self, v.account, quest.vote_stake + each)
      updateStats(g, v.account, (s) => {
        s.votes_correct += 1
        s.xp += 20
      })
    }
  } else {
    toBurn += voterPot
  }

  const rolled = rollCut + poolDust
  g.update('m', (m) => {
    m.rollover += rolled
    m.completed += 1
  })
  burn(g, self, toBurn, 'failed_stakes')

  quest.status = 'RESOLVED'
  quest.result = {
    winners: winners.map((w) => w.account),
    burned: toBurn,
    rolled_over: rolled,
    voter_pot: voterPot,
    correct_voters: correct.length,
    mood: heartbeat(g).mood,
  }
  g.write(qKey(id), quest)
  pulse(g, 1)
  g.emit('QUEST_RESOLVED', { id, ...quest.result })
  return quest.result
}
