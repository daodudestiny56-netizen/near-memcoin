import { req } from './codec.js'

export function balanceOf(g, account) {
  const text = g.store.get(`b:${account}`)
  return text === null ? 0n : BigInt(text)
}

function setBalance(g, account, value) {
  if (value === 0n) g.store.del(`b:${account}`)
  else g.store.set(`b:${account}`, value.toString())
}

export function mint(g, to, amount) {
  setBalance(g, to, balanceOf(g, to) + amount)
  g.update('m', (m) => {
    m.total_supply += amount
  })
  g.log('nep141', 'ft_mint', { owner_id: to, amount })
}

// Internal move (escrow, payouts). No NEP-141 event: game events cover these.
export function move(g, from, to, amount) {
  if (amount === 0n) return
  req(amount > 0n, 'amount must be positive')
  const balance = balanceOf(g, from)
  req(balance >= amount, `insufficient balance: ${from}`)
  setBalance(g, from, balance - amount)
  setBalance(g, to, balanceOf(g, to) + amount)
}

// The only way supply ever shrinks.
export function burn(g, from, amount, reason) {
  if (amount === 0n) return
  const balance = balanceOf(g, from)
  req(balance >= amount, `insufficient balance to burn: ${from}`)
  setBalance(g, from, balance - amount)
  g.update('m', (m) => {
    m.total_supply -= amount
    m.burned += amount
  })
  g.log('nep141', 'ft_burn', { owner_id: from, amount })
  g.emit('BURN', { amount, reason })
}

export function transfer(g, from, to, amount, memo = null) {
  req(from !== to, 'sender and receiver must differ')
  req(amount > 0n, 'amount must be positive')
  move(g, from, to, amount)
  g.log('nep141', 'ft_transfer', { old_owner_id: from, new_owner_id: to, amount, memo })
}

// After ft_on_transfer: unusedRaw is the receiver's reply (string amount) or null if it failed.
// Returns how much the receiver actually kept.
export function resolveTransfer(g, sender, receiver, amount, unusedRaw) {
  let unused = amount
  if (unusedRaw !== null && /^"?\d+"?$/.test(unusedRaw)) unused = BigInt(unusedRaw.replace(/"/g, ''))
  if (unused > amount) unused = amount
  const held = balanceOf(g, receiver)
  const refund = unused < held ? unused : held
  if (refund > 0n) {
    move(g, receiver, sender, refund)
    g.log('nep141', 'ft_transfer', { old_owner_id: receiver, new_owner_id: sender, amount: refund, memo: 'refund' })
  }
  return amount - refund
}
