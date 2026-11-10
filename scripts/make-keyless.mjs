// One-way hardening of the live testnet contract. IRREVERSIBLE, so it needs --yes.
//   1. tops up the contract's NEAR from the treasury (a keyless contract can still receive funds, but nobody can repair it)
//   2. calls lock_config as the owner, then proves set_config is rejected
//   3. deletes the contract account's only access key, then proves the account has 0 keys and still works
// After this nobody, including the author, can redeploy or change the code, or change the tunable config.
// Usage: node scripts/make-keyless.mjs --yes
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { KeyPair, nearToYocto } from 'near-api-js'
import { CONTRACT, call, loadAccount, provider, view } from './lib.mjs'

if (!process.argv.includes('--yes')) {
  console.error('This permanently locks the config and deletes the contract key. Re-run with --yes.')
  process.exit(1)
}
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const owner = loadAccount('mira-treasury.testnet')
const contract = loadAccount(CONTRACT)
const keyCount = async () => (await provider.viewAccessKeyList({ accountId: CONTRACT })).keys.length

// 1. storage headroom
const topUp = process.env.TOPUP_NEAR ?? '6'
if (topUp !== '0') {
  await owner.transfer({ receiverId: CONTRACT, amount: nearToYocto(topUp) })
  log(`topped up ${CONTRACT} with ${topUp} NEAR`)
}
const state = await provider.viewAccount({ accountId: CONTRACT })
log(`balance ${Number(BigInt(state.amount) / 10n ** 21n) / 1000} NEAR, storage ${state.storage_usage} bytes`)

// 2. lock the config
if (!(await view('get_overview')).config_locked) {
  await call(owner, 'lock_config')
  log('lock_config called')
}
if (!(await view('get_overview')).config_locked) throw new Error('config is not locked, stopping before the key is deleted')
const rejected = await call(owner, 'set_config', { config: { target_pulse: 99 } }).then(() => false, (e) => /locked/.test(e.message))
if (!rejected) throw new Error('set_config was not rejected after the lock, stopping before the key is deleted')
log('config locked, and set_config is rejected even for the owner')

// 3. delete the only key
const { private_key } = JSON.parse(readFileSync(join(homedir(), '.near-credentials', 'testnet', `${CONTRACT}.json`), 'utf8'))
const publicKey = KeyPair.fromString(private_key).getPublicKey().toString()
log(`keys before: ${await keyCount()} (${publicKey})`)
await contract.deleteKey(publicKey)
const after = await keyCount()
log(`keys after: ${after}`)
if (after !== 0) throw new Error('the contract still has access keys')

// the contract still serves reads and accepts calls from players
const o = await view('get_overview')
log('still live:', { mood: o.mood, quests: o.quests_created, config_locked: o.config_locked })
