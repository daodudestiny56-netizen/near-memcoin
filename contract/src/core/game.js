import { DEFAULT_CONFIG, EVENT_KEEP } from './constants.js'
import { decodeValue, encodeValue, plain } from './codec.js'

// One Game per transaction. `store` is get/set/del over strings; `deps` injects
// the host (sha256Hex, log) so the same rules run in Node tests and on-chain.
// ctx = { caller, now (ns, BigInt), self, deposit }
export class Game {
  constructor(store, deps, ctx) {
    this.store = store
    this.deps = deps
    this.ctx = ctx
  }

  read(key, fallback = null) {
    const text = this.store.get(key)
    return text === null ? fallback : decodeValue(text)
  }

  write(key, value) {
    this.store.set(key, encodeValue(value))
  }

  remove(key) {
    this.store.del(key)
  }

  // Load-modify-save in one step so no caller holds a stale copy across calls.
  update(key, fn, fallback = null) {
    const value = this.read(key, fallback)
    fn(value)
    this.write(key, value)
    return value
  }

  meta() {
    const meta = this.read('m')
    if (!meta) throw new Error('contract not initialised')
    return meta
  }

  cfg() {
    return { ...DEFAULT_CONFIG, ...(this.read('cfg') || {}) }
  }

  log(standard, event, data) {
    this.deps.log(`EVENT_JSON:${JSON.stringify({ standard, version: '1.0.0', event, data: [plain(data)] })}`)
  }

  // Game events: logged (NEP-297 style) and kept in a short ring for the live feed.
  emit(kind, data) {
    let seq = 0
    this.update('m', (m) => {
      seq = m.ev_seq
      m.ev_seq += 1
    })
    this.write(`ev:${seq}`, { i: seq, t: this.ctx.now, k: kind, d: plain(data) })
    if (seq >= EVENT_KEEP) this.remove(`ev:${seq - EVENT_KEEP}`)
    this.log('mira', kind, data)
  }

  recentEvents(limit = 20) {
    const next = this.meta().ev_seq
    const out = []
    for (let i = next - 1; i >= 0 && out.length < Math.min(limit, EVENT_KEEP); i--) {
      const ev = this.read(`ev:${i}`)
      if (!ev) break
      out.push(ev)
    }
    return out
  }
}
