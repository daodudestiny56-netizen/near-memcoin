// JSON that round-trips BigInt, so amounts never lose precision in storage.
export function encodeValue(value) {
  return JSON.stringify(value, (_, x) => (typeof x === 'bigint' ? { __big: x.toString() } : x))
}

export function decodeValue(text) {
  return JSON.parse(text, (_, x) =>
    x && typeof x === 'object' && typeof x.__big === 'string' ? BigInt(x.__big) : x,
  )
}

// For return values and logs: BigInt becomes a decimal string (NEP-141 style).
export function plain(value) {
  if (value === undefined) return null
  return JSON.parse(JSON.stringify(value, (_, x) => (typeof x === 'bigint' ? x.toString() : x)))
}

export function req(condition, message) {
  if (!condition) throw new Error(message)
}

export function parseAmount(text, field = 'amount') {
  req(typeof text === 'string' && /^\d+$/.test(text), `${field} must be a decimal string`)
  return BigInt(text)
}
