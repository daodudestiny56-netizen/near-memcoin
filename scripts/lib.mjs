import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Account, FailoverRpcProvider, JsonRpcProvider, KeyPairSigner } from 'near-api-js'

// Public RPCs rate-limit (HTTP 429); fail over between two FastNEAR endpoints and retry reads.
// (rpc.testnet.near.org is deprecated and answers 429 on purpose.)
export const RPCS = (process.env.NEAR_RPC ?? 'https://rpc.testnet.fastnear.com,https://test.rpc.fastnear.com').split(',')
export const CONTRACT = process.env.MIRA_CONTRACT ?? 'mira-memecoin.testnet'
export const GAS = 300_000_000_000_000n
export const ONE = 10n ** 18n

export const provider = new FailoverRpcProvider(RPCS.map((url) => new JsonRpcProvider({ url })))

// Loads ~/.near-credentials/testnet/<id>.json written by create-testnet-account.mjs
export function loadAccount(accountId) {
  const file = join(homedir(), '.near-credentials', 'testnet', `${accountId}.json`)
  const { private_key } = JSON.parse(readFileSync(file, 'utf8'))
  return new Account(accountId, provider, KeyPairSigner.fromSecretKey(private_key))
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function view(method, args = {}, contractId = CONTRACT) {
  let last
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await provider.callFunction({ contractId, method, args })
    } catch (e) {
      last = e
      await sleep(600 * 2 ** attempt)
    }
  }
  throw last
}

// Sends a call and returns the contract's return value; throws with the contract's panic message.
export async function call(account, method, args = {}, { deposit = 0n, contractId = CONTRACT } = {}) {
  try {
    return await account.callFunction({ contractId, methodName: method, args, gas: GAS, deposit })
  } catch (e) {
    const msg = String(e?.message ?? e)
    const m = msg.match(/panicked: ([^"\\\n]+)/)
    throw new Error(`${method} failed: ${m ? m[1] : msg.slice(0, 300)}`)
  }
}

export const tokens = (n) => (BigInt(Math.round(Number(n) * 100)) * ONE) / 100n
