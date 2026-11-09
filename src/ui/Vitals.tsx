import { useState } from 'react'
import { useMira } from '../state/mira'
import type { HistoryPoint, Mood } from '../chain/types'
import { MOODS } from './mood'
import Mascot from './Mascot'

const SPLITS: Record<Mood, [number, number, number]> = {
  THRIVING: [6000, 2000, 2000],
  STEADY: [5000, 3000, 2000],
  HUNGRY: [3500, 4500, 2000],
  STARVING: [2000, 6000, 2000],
}
const RATIO: Record<Mood, number> = { THRIVING: 1.6, STEADY: 1.1, HUNGRY: 0.6, STARVING: 0.2 }
const ORDER: Mood[] = ['THRIVING', 'STEADY', 'HUNGRY', 'STARVING']

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
  // Previewing a mood only changes this card: it never touches the chain.
  const [preview, setPreview] = useState<Mood | null>(null)
  if (!ov) return null
  const live: HistoryPoint[] = [
    ...ov.history.slice(-11),
    { epoch: ov.epoch, pulse: ov.pulse, mood: ov.mood },
  ]
  const shown: Mood = preview ?? ov.mood
  const [burn_bps, rollover_bps, voters_bps] = preview
    ? SPLITS[preview]
    : [ov.splits.burn_bps, ov.splits.rollover_bps, ov.splits.voters_bps]
  const info = MOODS[shown]

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
            <span className="chip" style={{ ['--mood' as string]: MOODS[ov.mood].color }}><i /> Live: {MOODS[ov.mood].label}</span>
          </header>
          <Heartbeat points={live} target={ov.target_pulse} />
          <p className="foot">Bars are on-chain actions per epoch. The rightmost bar is the epoch in progress.</p>
        </article>

        <article className="card mood-lab">
          <header className="card-head">
            <h3>Where a failed stake goes</h3>
          </header>
          <div className="mood-picker" role="group" aria-label="Preview a mood">
            <button className={preview === null ? 'pick on' : 'pick'} onClick={() => setPreview(null)}>Live</button>
            {ORDER.map((m) => (
              <button
                key={m}
                className={preview === m ? 'pick on' : 'pick'}
                style={{ ['--mood' as string]: MOODS[m].color }}
                onClick={() => setPreview(m)}
              >
                <i /> {MOODS[m].label}
              </button>
            ))}
          </div>
          <div className="preview-row" style={{ ['--mood' as string]: info.color }}>
            <Mascot mood={shown} ratio={RATIO[shown]} />
            <div>
              <strong>{preview ? `Preview: ${info.label}` : `Live: ${info.label}`}</strong>
              <p>{info.effect}</p>
            </div>
          </div>
          <div className="split-bar" role="img" aria-label="Burn, rollover and voter split">
            <div className="seg seg-burn" style={{ flexGrow: burn_bps }}><b>{burn_bps / 100}%</b><span>burned</span></div>
            <div className="seg seg-roll" style={{ flexGrow: rollover_bps }}><b>{rollover_bps / 100}%</b><span>next quest</span></div>
            <div className="seg seg-vote" style={{ flexGrow: voters_bps }}><b>{voters_bps / 100}%</b><span>right voters</span></div>
          </div>
          <p className="foot">{preview ? 'Preview only. The live mood is set by on-chain activity.' : 'This is the split the contract uses right now.'}</p>
        </article>
      </div>
    </section>
  )
}
