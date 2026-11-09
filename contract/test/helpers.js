import { createHash } from 'node:crypto'
import { Game } from '../src/core/game.js'
import { init } from '../src/core/admin.js'
import { NS, ONE } from '../src/core/constants.js'

export const sha256Hex = (text) => createHash('sha256').update(text).digest('hex')

// A fresh in-memory chain. `as(account, seconds)` opens a transaction at that time.
export function chain(options = {}) {
  const data = new Map()
  const logs = []
  const store = {
    get: (k) => (data.has(k) ? data.get(k) : null),
    set: (k, v) => void data.set(k, v),
    del: (k) => void data.delete(k),
  }
  const deps = { sha256Hex, log: (line) => logs.push(line) }
  const self = 'mira.testnet'
  const as = (caller, seconds = 0, deposit = 0n) =>
    new Game(store, deps, { caller, now: BigInt(seconds) * NS, self, deposit })
  if (options.init !== false) {
    init(as('owner.testnet', 0), { owner_id: 'owner.testnet', faucet_on: true, config: options.config })
  }
  return { as, store, logs, self, data }
}

export const tokens = (n) => BigInt(n) * ONE
