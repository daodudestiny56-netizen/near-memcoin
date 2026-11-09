import test from 'ava'
import { createHash } from 'node:crypto'
import { Worker, Gas } from 'near-workspaces'

const ONE = 10n ** 18n
const GAS = { gas: Gas.parse('300 Tgas') }
const YOCTO = { ...GAS, attachedDeposit: '1' }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Block time drives the phases, so wait on the chain's own view of the quest.
async function waitForPhase(mira, id, phase, timeoutMs = 90_000) {
  const start = Date.now()
  for (;;) {
    const quest = await mira.view('get_quest', { id })
    if (quest.phase === phase) return
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${phase}, stuck in ${quest.phase}`)
    await sleep(500)
  }
}
const sha256Hex = (text) => createHash('sha256').update(text).digest('hex')

test.before(async (t) => {
  const worker = await Worker.init()
  const root = worker.rootAccount
  const mira = await root.createSubAccount('mira', { initialBalance: '20 N' })
  await mira.deploy('build/mira.wasm')
  await root.call(mira, 'init', {
    owner_id: root.accountId,
    faucet_on: true,
    // short clocks so a whole quest fits in a test run
    config: { epoch_s: 3600, propose_streak: 1, min_phase_s: 1, target_pulse: 4 },
  }, GAS)
  const names = ['ana', 'bob', 'cy', 'dee', 'eve']
  const players = {}
  for (const name of names) players[name] = await root.createSubAccount(name, { initialBalance: '5 N' })
  t.context = { worker, root, mira, players }
})

test.after.always(async (t) => {
  await t.context.worker.tearDown()
})

test.serial('metadata and initial supply follow NEP-141', async (t) => {
  const { mira, root } = t.context
  t.is(await mira.view('ft_total_supply'), (10_000_000n * ONE).toString())
  t.is(await mira.view('ft_balance_of', { account_id: root.accountId }), (10_000_000n * ONE).toString())
  const meta = await mira.view('ft_metadata')
  t.is(meta.symbol, 'MIRA')
  t.is(meta.decimals, 18)
})

test.serial('ft_transfer needs exactly 1 yoctoNEAR and moves tokens', async (t) => {
  const { mira, root, players } = t.context
  await t.throwsAsync(() => root.call(mira, 'ft_transfer', { receiver_id: players.ana.accountId, amount: '5' }, GAS))
  await root.call(mira, 'ft_transfer', { receiver_id: players.ana.accountId, amount: '5' }, YOCTO)
  t.is(await mira.view('ft_balance_of', { account_id: players.ana.accountId }), '5')
})

test.serial('ft_transfer_call to a non-contract refunds the sender in full', async (t) => {
  const { mira, root, players } = t.context
  const before = await mira.view('ft_balance_of', { account_id: root.accountId })
  await root.call(mira, 'ft_transfer_call', {
    receiver_id: players.eve.accountId, amount: '1000', msg: 'hi',
  }, YOCTO)
  t.is(await mira.view('ft_balance_of', { account_id: root.accountId }), before)
  t.is(await mira.view('ft_balance_of', { account_id: players.eve.accountId }), '0')
})

test.serial('faucet pays once per account', async (t) => {
  const { mira, players } = t.context
  for (const p of Object.values(players)) await p.call(mira, 'claim', {}, GAS)
  t.is(await mira.view('ft_balance_of', { account_id: players.bob.accountId }), (1000n * ONE).toString())
  await t.throwsAsync(() => players.bob.call(mira, 'claim', {}, GAS))
})

test.serial('a full quest: propose, join, vote hidden, reveal, settle, burn', async (t) => {
  const { mira, players } = t.context
  const { ana, bob, cy, dee, eve } = players
  await ana.call(mira, 'gm', {}, GAS)
  const supplyBefore = BigInt(await mira.view('ft_total_supply'))

  const id = await ana.call(mira, 'propose_quest', {
    title: 'Touch grass', description: 'park photo', stake: (25n * ONE).toString(),
    submit_s: 25, commit_s: 15, reveal_s: 15,
  }, GAS)
  t.is(id, 1)
  t.is(BigInt(await mira.view('ft_total_supply')), supplyBefore - 50n * ONE)

  for (const p of [bob, cy, ana]) {
    await p.call(mira, 'join_quest', { id }, GAS)
    await p.call(mira, 'submit_proof', { id, proof: `proof from ${p.accountId}` }, GAS)
  }

  await waitForPhase(mira, id, 'COMMIT')
  const salt = 'sandbox'
  for (const voter of [dee, eve]) {
    const commit = sha256Hex(`${id}:${voter.accountId}:${bob.accountId}:${salt}`)
    await voter.call(mira, 'commit_vote', { id, commit }, GAS)
  }
  await waitForPhase(mira, id, 'REVEAL')
  for (const voter of [dee, eve]) {
    await voter.call(mira, 'reveal_vote', { id, entrant: bob.accountId, salt }, GAS)
  }
  await waitForPhase(mira, id, 'SETTLE')
  const result = await ana.call(mira, 'resolve_quest', { id }, GAS)
  t.deepEqual(result.winners, [bob.accountId])
  t.is(result.correct_voters, 2)

  // bob: 1000 - 25 stake + 25 back + no pool; losers (cy, ana) forfeit 50, part of it burned
  t.is(await mira.view('ft_balance_of', { account_id: bob.accountId }), (1000n * ONE).toString())
  t.true(BigInt(await mira.view('ft_total_supply')) < supplyBefore - 50n * ONE)
  const q = await mira.view('get_quest', { id })
  t.is(q.status, 'RESOLVED')

  const overview = await mira.view('get_overview')
  t.true(BigInt(overview.burned) > 50n * ONE)
  const events = await mira.view('recent_events', { limit: 5 })
  t.true(events.length > 0)
  const board = await mira.view('get_leaderboard', { limit: 3 })
  t.is(board[0].account, bob.accountId)
})
