// Creates a funded NEAR testnet account via the public testnet faucet.
// Usage: node scripts/create-testnet-account.mjs <name.testnet> [<name2.testnet> ...]
// The first name that is free is created. The private key is written to
// ~/.near-credentials/testnet/<account>.json (the NEAR CLI location) and never printed.
import { generateKeyPairSync } from 'node:crypto'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const FAUCETS = ['https://helper.nearprotocol.com/account', 'https://helper.testnet.near.org/account']
const RPC = 'https://rpc.testnet.fastnear.com'
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58(bytes) {
  let n = 0n
  for (const b of bytes) n = n * 256n + BigInt(b)
  let out = ''
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out
    n /= 58n
  }
  for (const b of bytes) {
    if (b !== 0) break
    out = '1' + out
  }
  return out
}

export function newKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32)
  const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)
  return {
    publicKey: `ed25519:${base58(pub)}`,
    secretKey: `ed25519:${base58(Buffer.concat([seed, pub]))}`,
  }
}

async function accountExists(id) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: id } }),
  })
  const json = await res.json()
  return !json.error && !!json.result
}

async function balanceNear(id) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: id } }),
  })
  const json = await res.json()
  return Number(BigInt(json.result.amount) / 10n ** 20n) / 1e4
}

const names = process.argv.slice(2)
if (names.length === 0) {
  console.error('usage: node scripts/create-testnet-account.mjs <name.testnet> [fallback.testnet ...]')
  process.exit(1)
}

for (const name of names) {
  if (await accountExists(name)) {
    console.log(`${name}: already taken, trying next`)
    continue
  }
  const keys = newKeyPair()
  let created = false
  for (const url of FAUCETS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newAccountId: name, newAccountPublicKey: keys.publicKey }),
      })
      console.log(`${name}: faucet ${new URL(url).host} -> HTTP ${res.status}`)
      if (res.ok) {
        created = true
        break
      }
      console.log((await res.text()).slice(0, 200))
    } catch (e) {
      console.log(`${name}: faucet ${new URL(url).host} unreachable (${e.message})`)
    }
  }
  if (!created) continue
  // the faucet answers before the block lands; wait for the account to appear
  let ready = false
  for (let i = 0; i < 20 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    ready = await accountExists(name)
  }
  if (!ready) {
    console.log(`${name}: faucet accepted but the account did not appear`)
    continue
  }
  const dir = join(homedir(), '.near-credentials', 'testnet')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${name}.json`)
  if (existsSync(file)) throw new Error(`refusing to overwrite ${file}`)
  writeFileSync(file, JSON.stringify({ account_id: name, public_key: keys.publicKey, private_key: keys.secretKey }, null, 2), { mode: 0o600 })
  console.log(`created ${name} with ${await balanceNear(name)} NEAR`)
  console.log(`key saved to ${file}`)
  process.exit(0)
}
console.error('no account could be created')
process.exit(1)
