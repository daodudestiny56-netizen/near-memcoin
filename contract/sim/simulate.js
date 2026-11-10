// Usage: node sim/simulate.js   (from contract/)  ->  sim/results.json, ../public/simulation.svg, a markdown table on stdout
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCENARIOS, runScenario } from './engine.js'

const here = dirname(fileURLToPath(import.meta.url))
const DAYS = 60
const results = SCENARIOS.map((sc) => runScenario(sc, { days: DAYS }))

writeFileSync(join(here, 'results.json'), JSON.stringify(results, null, 2) + '\n')

// ---- markdown table -------------------------------------------------------------------------------
const n = (x, d = 0) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const rows = results.map((r) => {
  const m = r.moodDays
  return `| ${r.label} | ${m.THRIVING} / ${m.STEADY} / ${m.HUNGRY} / ${m.STARVING} | ${r.settled} / ${r.voided} | ${n(r.burned)} | ${n(r.circulatingStart)} → ${n(r.circulatingEnd)} | ${n(r.rolloverEnd)} | ${n(r.keeperEarned)} |`
})
const table = [
  '| Scenario | Days thriving / steady / hungry / starving | Quests settled / void | Burned (MIRA) | Circulating (MIRA) | Quest pool at end | Keeper bounties |',
  '|---|---|---|---|---|---|---|',
  ...rows,
].join('\n')
console.log('\n' + table + '\n')
for (const r of results) {
  if (r.ring) {
    console.log(`ring: ${r.ring.accounts} accounts, net ${n(r.ring.change, 1)} MIRA (honest players: ${n(r.honestChange / r.honestPlayers, 1)} each), won ${(r.ring.winShare * 100).toFixed(0)}% of wins from ${(r.ring.entryShare * 100).toFixed(0)}% of entries`)
  }
  console.log(`${r.key}: burns from proposals ${n(r.burnedByProposals)}, from failed stakes ${n(r.burnedByFailedStakes, 1)}, starve taxes ${r.starveEvents}, honest players' net ${n(r.honestChange / r.honestPlayers, 1)} each`)
}

// ---- chart ---------------------------------------------------------------------------------------
const STYLE = {
  thriving: { color: '#13795b', dash: '' },
  fading: { color: '#b45f06', dash: '8 5' },
  quiet: { color: '#566380', dash: '2 4' },
  sybil: { color: '#b42318', dash: '10 4 2 4' },
}
const W = 900
const PANEL_H = 250
const M = { l: 78, r: 24 }
const TOP_1 = 100
const TOP_2 = TOP_1 + PANEL_H + 92
const LEGEND_Y = TOP_2 + PANEL_H + 62
const H = LEGEND_Y + 50

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v || 1))
  for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= v) return s * p
  return 10 * p
}

function panel(title, sub, pick, top) {
  const max = niceMax(Math.max(...results.flatMap((r) => r.series.map(pick))))
  const x = (day) => M.l + ((day - 1) / (DAYS - 1)) * (W - M.l - M.r)
  const y = (v) => top + PANEL_H - (v / max) * PANEL_H
  let g = `<text x="${M.l}" y="${top - 30}" font-size="15" font-weight="700" fill="#14211b">${title}</text>`
  g += `<text x="${M.l}" y="${top - 12}" font-size="11.5" fill="#566380">${sub}</text>`
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i
    g += `<line x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e3e8e5"/>`
    g += `<text x="${M.l - 8}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#566380">${n(v)}</text>`
  }
  for (let d = 0; d <= DAYS; d += 10) {
    const px = x(Math.max(d, 1))
    g += `<text x="${px}" y="${top + PANEL_H + 16}" font-size="11" text-anchor="middle" fill="#566380">${d === 0 ? 'day 1' : `day ${d}`}</text>`
  }
  for (const r of results) {
    const s = STYLE[r.key]
    const pts = r.series.map((p) => `${x(p.day).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ')
    g += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`
  }
  return g
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" role="img" aria-label="Simulated MIRA supply over 60 days under four community scenarios">`
svg += `<rect width="${W}" height="${H}" rx="14" fill="#fbfcfa"/>`
svg += `<text x="${M.l}" y="30" font-size="18" font-weight="800" fill="#14211b">60 days of MIRA under four communities</text>`
svg += panel('Circulating supply (MIRA)', 'Held by players: excludes the treasury, escrow and the quest pool. Nothing mints, so it can only fall.', (p) => p.circulating, TOP_1)
svg += panel('Cumulative burned (MIRA)', 'Proposal burns plus the burn share of failed stakes.', (p) => p.burned, TOP_2)
let lx = M.l
for (const r of results) {
  const s = STYLE[r.key]
  svg += `<line x1="${lx}" x2="${lx + 30}" y1="${LEGEND_Y}" y2="${LEGEND_Y}" stroke="${s.color}" stroke-width="2.6" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`
  svg += `<text x="${lx + 38}" y="${LEGEND_Y + 4}" font-size="12" fill="#14211b">${r.label}</text>`
  lx += 62 + r.label.length * 7.4
}
svg += `<text x="${M.l}" y="${LEGEND_Y + 30}" font-size="11" fill="#566380">The sybil line starts higher because its 12 attacker accounts each take the 1,000 MIRA demo faucet. Real contract rules, 30 simulated players, seed 7.</text>`
svg += '</svg>\n'
const out = join(here, '..', '..', 'public', 'simulation.svg')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, svg)
console.log(`wrote ${out}`)
