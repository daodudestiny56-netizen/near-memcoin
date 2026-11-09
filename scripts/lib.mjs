import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Account, JsonRpcProvider, KeyPairSigner } from 'near-api-js'

export const RPC = process.env.NEAR_RPC ?? 'https://rpc.testnet.fastnear.com'
export const CONTRACT = process.env.MIRA_CONTRACT ?? 'mira-memecoin.testnet'
export const GAS = 300_000_000_000_000n
export const ONE = 10n ** 18n

export const provider = new JsonRpcProvider({ url: RPC })

// Loads ~/.near-credentials/testnet/<id>.json written by create-testnet-account.mjs
export function loadAccount(accountId) {
  const file = join(homedir(), '.near-credentials', 'testnet', `${accountId}.json`)
  const { private_key } = JSON.parse(readFileSync(file, 'utf8'))
  return new Account(accountId, provider, KeyPairSigner.fromSecretKey(private_key))
}

export async function view(method, args = {}, contractId = CONTRACT) {
  return provider.callFunction({ contractId, method, args })
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
