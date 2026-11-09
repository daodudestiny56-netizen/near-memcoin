import { useMira } from '../state/mira'
import type { HistoryPoint } from '../chain/types'
import { MOODS } from './mood'

function Heartbeat({ points, target }: { points: HistoryPoint[]; target: number }) {
  const w = 560
  const h = 150
  const max = Math.max(target * 1.8, ...points.map((p) => p.pulse), 1)
  const gap = 8
  const bar = (w - gap * (points.length - 1)) / Math.max(points.length, 1)
  const ty = h - (target / max) * h
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} className="heartbeat" role="img" aria-label="Pulse per epoch against the target">
      <line x1="0" x2={w} y1={ty} y2={ty} className="target-line" />
      <text x={w} y={ty - 6} textAnchor="end" className="target-text">target {target}</text>
      {points.map((p, i) => {
        const bh = Math.max(3, (p.pulse / max) * h)
        return (
          <g key={`${p.epoch}-${i}`}>
            <rect
              x={i * (bar + gap)} y={h - bh} width={bar} height={bh} rx="5"
              fill={MOODS[p.mood].color} opacity={i === points.length - 1 ? 1 : 0.82}
            >
              <title>{`Epoch ${p.epoch}: ${p.pulse} actions · ${MOODS[p.mood].label}`}</title>
            </rect>
            <text x={i * (bar + gap) + bar / 2} y={h + 16} textAnchor="middle" className="bar-label">{p.pulse}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Vitals() {
  const { overview: ov } = useMira()
  if (!ov) return null
  const live: HistoryPoint[] = [
    ...ov.history.slice(-11),
    { epoch: ov.epoch, pulse: ov.pulse, mood: ov.mood },
  ]
  const { burn_bps, rollover_bps, voters_bps } = ov.splits
  const info = MOODS[ov.mood]

  return (
    <section className="section vitals">
      <div className="section-head">
        <p className="kicker">01 · The mechanic, live</p>
        <h2>Supply that reacts to people.</h2>
        <p className="sub">
          Every join, vote, gm and settlement is a beat. The last epoch's beats decide MIRA's mood,
          and the mood decides how hard failed stakes burn.
        </p>
      </div>

      <div className="vitals-grid">
        <article className="card">
          <header className="card-head">
            <h3>Heartbeat</h3>
            <span className="chip" style={{ ['--mood' as string]: info.color }}><i /> {info.label}</span>
          </header>
          <Heartbeat points={live} target={ov.target_pulse} />
          <p className="foot">Bars are on-chain actions per epoch. The rightmost bar is the epoch in progress.</p>
        </article>

        <article className="card">
          <header className="card-head">
            <h3>Where a failed stake goes right now</h3>
          </header>
          <div className="split-bar" role="img" aria-label="Burn, rollover and voter split">
            <div className="seg seg-burn" style={{ flexGrow: burn_bps }}><b>{burn_bps / 100}%</b><span>burned</span></div>
            <div className="seg seg-roll" style={{ flexGrow: rollover_bps }}><b>{rollover_bps / 100}%</b><span>next quest</span></div>
            <div className="seg seg-vote" style={{ flexGrow: voters_bps }}><b>{voters_bps / 100}%</b><span>right voters</span></div>
          </div>
          <p className="foot">{info.effect}</p>
          <ul className="mini-list">
            <li><span>Thriving</span><b>60 / 20 / 20</b></li>
            <li><span>Steady</span><b>50 / 30 / 20</b></li>
            <li><span>Hungry</span><b>35 / 45 / 20</b></li>
            <li><span>Starving</span><b>20 / 60 / 20</b></li>
          </ul>
        </article>
      </div>
    </section>
  )
}
