// Deploys contract/wasm/mira.wasm (built and sandbox-tested by CI) to testnet and initialises it.
// Usage: node scripts/deploy.mjs [owner.testnet]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CONTRACT, call, loadAccount, provider, view } from './lib.mjs'

const owner = process.argv[2] ?? 'mira-treasury.testnet'
const wasmPath = fileURLToPath(new URL('../contract/wasm/mira.wasm', import.meta.url))
const wasm = readFileSync(wasmPath)
const account = loadAccount(CONTRACT)

// Storage costs 1e19 yoctoNEAR per byte; keep a small float for gas.
const state = await provider.viewAccount({ accountId: CONTRACT })
const needed = BigInt(wasm.length) * 10n ** 19n
const balance = BigInt(state.amount)
console.log(`wasm ${(wasm.length / 1024).toFixed(0)} KB needs ~${Number(needed / 10n ** 21n) / 1000} NEAR of storage; ${CONTRACT} holds ${Number(balance / 10n ** 21n) / 1000} NEAR`)
if (balance < needed + 10n ** 24n) {
  console.error('not enough balance to cover storage: top the account up first (scripts/topup.mjs)')
  process.exit(2)
}

let initialised = false
try {
  await view('get_config')
  initialised = true
} catch {
  // not deployed or not initialised yet
}
if (initialised) {
  console.log('already deployed and initialised, nothing to do')
  process.exit(0)
}

console.log('deploying…')
await account.deployContract(wasm)
console.log('initialising with owner', owner)
await call(account, 'init', {
  owner_id: owner,
  faucet_on: true,
  // Demo clocks: 15-minute epochs, and one gm unlocks proposing.
  config: { epoch_s: 900, target_pulse: 10, min_phase_s: 20, propose_streak: 1 },
})

const overview = await view('get_overview')
console.log('live:', { total_supply: overview.total_supply, mood: overview.mood, epoch: overview.epoch })
console.log(`contract ${CONTRACT} is live on testnet`)
