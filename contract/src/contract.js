import { NearBindgen, near, call, view, initialize, NearPromise, encode, decode, assert } from 'near-sdk-js'
import { Game } from './core/game.js'
import { parseAmount, plain } from './core/codec.js'
import { DECIMALS } from './core/constants.js'
import { init as coreInit, setConfig, setExempt, setFaucet } from './core/admin.js'
import { balanceOf, resolveTransfer, transfer } from './core/token.js'
import { claim as coreClaim, gm as coreGm, leaderboard } from './core/players.js'
import { join, listQuests, propose, submitProof } from './core/quests.js'
import { commitVote, resolve, revealVote } from './core/settle.js'
import { starve as coreStarve } from './core/starve.js'
import { config, dashboard as coreDashboard, overview, player, questDetail } from './core/views.js'

const TGAS = 1_000_000_000_000n
const ICON =
  'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Ccircle cx=%2732%27 cy=%2732%27 r=%2730%27 fill=%27%2341bf7b%27/%3E%3Ctext x=%2732%27 y=%2745%27 font-size=%2738%27 text-anchor=%27middle%27 fill=%27white%27 font-family=%27sans-serif%27 font-weight=%27700%27%3Em%3C/text%3E%3C/svg%3E'

const store = {
  get: (key) => {
    const raw = near.storageReadRaw(encode(key))
    return raw === null ? null : decode(raw)
  },
  set: (key, value) => void near.storageWriteRaw(encode(key), encode(value)),
  del: (key) => void near.storageRemoveRaw(encode(key)),
}

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
const deps = {
  sha256Hex: (text) => toHex(near.sha256(encode(text))),
  log: (line) => near.log(line),
}

function game() {
  return new Game(store, deps, {
    caller: near.predecessorAccountId(),
    now: near.blockTimestamp(),
    self: near.currentAccountId(),
    deposit: near.attachedDeposit(),
  })
}

// NEAR forbids predecessor_account_id and attached_deposit inside view calls.
function viewGame() {
  return new Game(store, deps, {
    caller: '',
    now: near.blockTimestamp(),
    self: near.currentAccountId(),
    deposit: 0n,
  })
}

const oneYocto = () => assert(near.attachedDeposit() === 1n, 'Requires attached deposit of exactly 1 yoctoNEAR')

@NearBindgen({ requireInit: true })
export class MiraContract {
  ready = false

  @initialize({})
  init({ owner_id, faucet_on, config: cfg }) {
    coreInit(game(), { owner_id, faucet_on, config: cfg || {} })
    this.ready = true
  }

  // ---- NEP-141 -------------------------------------------------------------

  @call({ payableFunction: true })
  ft_transfer({ receiver_id, amount, memo }) {
    oneYocto()
    const g = game()
    transfer(g, g.ctx.caller, receiver_id, parseAmount(amount), memo || null)
  }

  @call({ payableFunction: true })
  ft_transfer_call({ receiver_id, amount, memo, msg }) {
    oneYocto()
    const g = game()
    const sender = g.ctx.caller
    const value = parseAmount(amount)
    transfer(g, sender, receiver_id, value, memo || null)
    const gasLeft = near.prepaidGas() - near.usedGas()
    assert(gasLeft > 60n * TGAS, 'Not enough gas attached for ft_transfer_call')
    const onTransfer = gasLeft - 35n * TGAS
    return NearPromise.new(receiver_id)
      .functionCall(
        'ft_on_transfer',
        JSON.stringify({ sender_id: sender, amount: value.toString(), msg }),
        0n,
        onTransfer,
      )
      .then(
        NearPromise.new(near.currentAccountId()).functionCall(
          'ft_resolve_transfer',
          JSON.stringify({ sender_id: sender, receiver_id, amount: value.toString() }),
          0n,
          15n * TGAS,
        ),
      )
      .asReturn()
  }

  @call({ privateFunction: true })
  ft_resolve_transfer({ sender_id, receiver_id, amount }) {
    let unused = null
    try {
      unused = near.promiseResult(0)
    } catch {
      unused = null // receiver failed: refund everything
    }
    return resolveTransfer(game(), sender_id, receiver_id, parseAmount(amount), unused).toString()
  }

  @view({})
  ft_total_supply() {
    return viewGame().meta().total_supply.toString()
  }

  @view({})
  ft_balance_of({ account_id }) {
    return balanceOf(viewGame(), account_id).toString()
  }

  @view({})
  ft_metadata() {
    return {
      spec: 'ft-1.0.0',
      name: 'MIRA',
      symbol: 'MIRA',
      icon: ICON,
      reference: null,
      reference_hash: null,
      decimals: DECIMALS,
    }
  }

  // ---- NEP-145 (no-op: the contract pays storage, so accounts are free to register) ----

  @call({ payableFunction: true })
  storage_deposit() {
    const refund = near.attachedDeposit()
    if (refund > 0n) NearPromise.new(near.predecessorAccountId()).transfer(refund).build()
    return { total: '0', available: '0' }
  }

  @view({})
  storage_balance_of() {
    return { total: '0', available: '0' }
  }

  @view({})
  storage_balance_bounds() {
    return { min: '0', max: '0' }
  }

  // ---- The game ------------------------------------------------------------

  @call({})
  gm() {
    return coreGm(game())
  }

  @call({})
  claim() {
    return coreClaim(game()).toString()
  }

  @call({})
  propose_quest({ title, description, stake, seed, submit_s, commit_s, reveal_s }) {
    return propose(game(), {
      title,
      description: description || '',
      stake: parseAmount(stake, 'stake'),
      seed: seed ? parseAmount(seed, 'seed') : 0n,
      submit_s,
      commit_s,
      reveal_s,
    })
  }

  @call({})
  join_quest({ id }) {
    join(game(), id)
  }

  @call({})
  submit_proof({ id, proof }) {
    submitProof(game(), id, proof)
  }

  @call({})
  commit_vote({ id, commit }) {
    commitVote(game(), id, commit)
  }

  @call({})
  reveal_vote({ id, entrant, salt }) {
    revealVote(game(), id, entrant, salt)
  }

  @call({})
  resolve_quest({ id }) {
    return plain(resolve(game(), id))
  }

  @call({})
  starve({ account_id }) {
    return plain(coreStarve(game(), account_id))
  }

  // ---- Owner (clocks and thresholds only; cannot mint, pause or touch escrow) ----

  @call({})
  set_config({ config: cfg }) {
    setConfig(game(), cfg || {})
  }

  @call({})
  set_exempt({ account_id, exempt }) {
    setExempt(game(), account_id, !!exempt)
  }

  @call({})
  set_faucet({ on }) {
    setFaucet(game(), on)
  }

  // ---- Views ---------------------------------------------------------------

  @view({})
  get_overview() {
    return plain(overview(viewGame()))
  }

  @view({})
  get_dashboard({ account_id, quest_limit, event_limit, board_limit }) {
    return plain(coreDashboard(viewGame(), {
      account: account_id || null,
      quest_limit: Math.min(quest_limit || 8, 12),
      event_limit: Math.min(event_limit || 30, 50),
      board_limit: Math.min(board_limit || 10, 25),
    }))
  }

  @view({})
  get_config() {
    return plain(config(viewGame()))
  }

  @view({})
  list_quests({ from_id, limit }) {
    return plain(listQuests(viewGame(), from_id || 1, Math.min(limit || 20, 50)))
  }

  @view({})
  get_quest({ id }) {
    return plain(questDetail(viewGame(), id))
  }

  @view({})
  get_player({ account_id }) {
    return plain(player(viewGame(), account_id))
  }

  @view({})
  get_leaderboard({ limit }) {
    return plain(leaderboard(viewGame(), limit || 10))
  }

  @view({})
  recent_events({ limit }) {
    return plain(viewGame().recentEvents(limit || 20))
  }
}
