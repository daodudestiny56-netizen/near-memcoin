// Usage: node sim/sweep.js (from contract/)  ->  sim/sweep.json and a markdown table on stdout
// Sweeps the two knobs that decide how the coin feels, on three communities, 60 days, fixed seed.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCENARIOS, runScenario } from './engine.js'

const TARGETS = [10, 20, 40] // beats per epoch the community must reach to be STEADY
const TAX_BPS = [50, 100, 200] // starvation tax per idle holder per epoch
const communities = SCENARIOS.filter((s) => ['thriving', 'fading', 'quiet'].includes(s.key))

const rows = []
for (const target_pulse of TARGETS) {
  for (const starve_bps of TAX_BPS) {
    for (const sc of communities) {
      const r = runScenario(sc, { quiet: true, config: { target_pulse, starve_bps } })
      rows.push({
        target_pulse, starve_bps, scenario: sc.key,
        thrivingDays: r.moodDays.THRIVING, starvingDays: r.moodDays.STARVING,
        burned: r.burned, pool: r.rolloverEnd, keeper: r.keeperEarned,
        honestNet: Math.round((r.honestChange / r.honestPlayers) * 10) / 10,
      })
    }
  }
}
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'sweep.json'), JSON.stringify(rows, null, 2) + '\n')

const n = (x) => Math.round(x).toLocaleString('en-US')
console.log('| target | tax | thriving: burned (days thriving) | fading: burned (days starving) | quiet: pool parked / honest net each |')
console.log('|---|---|---|---|---|')
for (const target_pulse of TARGETS) {
  for (const starve_bps of TAX_BPS) {
    const g = (k) => rows.find((r) => r.target_pulse === target_pulse && r.starve_bps === starve_bps && r.scenario === k)
    const [t, f, q] = [g('thriving'), g('fading'), g('quiet')]
    console.log(`| ${target_pulse} | ${starve_bps / 100}% | ${n(t.burned)} (${t.thrivingDays}) | ${n(f.burned)} (${f.starvingDays}) | ${n(q.pool)} / ${q.honestNet} |`)
  }
}
