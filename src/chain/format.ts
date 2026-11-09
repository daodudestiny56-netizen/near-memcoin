import { DECIMALS } from './config'

const UNIT = 10n ** BigInt(DECIMALS)

export function toBig(raw: string | number | bigint | undefined | null): bigint {
  if (raw === undefined || raw === null || raw === '') return 0n
  try {
    return BigInt(raw)
  } catch {
    return 0n
  }
}

// "1234567000000000000000000" -> "1,234,567"; keeps up to `frac` decimals when small.
export function fmt(raw: string | bigint | undefined, frac = 2): string {
  const value = toBig(raw)
  const whole = value / UNIT
  const rest = value % UNIT
  const grouped = whole.toLocaleString('en-US')
  if (frac === 0 || rest === 0n) return grouped
  const digits = rest.toString().padStart(DECIMALS, '0').slice(0, frac).replace(/0+$/, '')
  return digits ? `${grouped}.${digits}` : grouped
}

// Compact: 1.2M, 340K, 12.5
export function compact(raw: string | bigint | undefined): string {
  const n = Number(toBig(raw) / 10n ** BigInt(DECIMALS - 4)) / 1e4
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n)
}

// "25" or "25.5" -> raw base units string. Returns null if invalid.
export function parseTokens(input: string): string | null {
  const text = input.trim()
  if (!/^\d+(\.\d{1,18})?$/.test(text)) return null
  const [whole, frac = ''] = text.split('.')
  return (BigInt(whole) * UNIT + BigInt(frac.padEnd(DECIMALS, '0'))).toString()
}

export function nsToMs(ns: string): number {
  return Number(toBig(ns) / 1_000_000n)
}

export function countdown(ms: number): string {
  if (ms <= 0) return '0s'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`
  return `${sec}s`
}

export function shortAccount(id: string, max = 22): string {
  return id.length <= max ? id : `${id.slice(0, max - 9)}…${id.slice(-7)}`
}

export function pct(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0
  return Number((part * 10000n) / whole) / 100
}

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
