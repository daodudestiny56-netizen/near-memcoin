import { useMira } from '../state/mira'
import { compact, countdown, fmt } from '../chain/format'
import { MOODS } from './mood'
import Mascot from './Mascot'
import { useNow } from './useNow'

export default function Hero() {
  const { overview: ov, config, status, error } = useMira()
  const now = useNow()
  const mood = ov?.mood ?? 'STEADY'
  const info = MOODS[mood]
  const ratio = ov ? ov.pulse / Math.max(1, ov.target_pulse) : 0.5
  const epochEnd = ov && config ? (ov.epoch + 1) * config.epoch_s * 1000 : 0

  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow"><span className={`live-dot ${status}`} /> {status === 'live' ? 'Live on NEAR' : status === 'loading' ? 'Connecting to NEAR…' : 'Chain unreachable'}</p>
        <h1>
          The memecoin<br />
          that is <em>alive.</em>
        </h1>
        <p className="lede">
          MIRA breathes with its community. Stake on quests, vote in secret, and watch failed
          stakes burn on-chain. When nobody shows up, the coin starves, and anyone can feed it.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary btn-lg" href="#quests">Play a quest</a>
          <a className="btn btn-ghost btn-lg" href="#rules">See the mechanic</a>
        </div>
        {status === 'offline' && <p className="inline-error">Can't reach the contract right now. {error}</p>}
      </div>

      <div className="hero-stage">
        <div className="mood-card" style={{ ['--mood' as string]: info.color }}>
          <Mascot mood={mood} ratio={ratio} />
          <div className="mood-meta">
            <span className="mood-tag"><i /> {info.label}</span>
            <p>{info.line}</p>
          </div>
        </div>
        <div className="pulse-card">
          <div>
            <span className="label">Pulse this epoch</span>
            <strong className="num">{ov ? ov.pulse : '–'}<small> / {ov?.target_pulse ?? '–'}</small></strong>
          </div>
          <div>
            <span className="label">Next heartbeat</span>
            <strong className="num">{epochEnd ? countdown(epochEnd - now) : '–'}</strong>
          </div>
        </div>
      </div>

      <dl className="stat-strip" id="vitals">
        <div>
          <dt>Total supply</dt>
          <dd className="num">{ov ? compact(ov.total_supply) : '–'}<small>MIRA</small></dd>
        </div>
        <div className="burn-stat">
          <dt>Burned forever</dt>
          <dd className="num">{ov ? fmt(ov.burned, 0) : '–'}<small>MIRA</small></dd>
        </div>
        <div>
          <dt>In circulation</dt>
          <dd className="num">{ov ? compact(ov.circulating) : '–'}<small>MIRA</small></dd>
        </div>
        <div>
          <dt>Next quest pool</dt>
          <dd className="num">{ov ? fmt(ov.rollover, 0) : '–'}<small>MIRA</small></dd>
        </div>
        <div>
          <dt>Quests settled</dt>
          <dd className="num">{ov ? `${ov.quests_completed}` : '–'}<small>of {ov?.quests_created ?? '–'}</small></dd>
        </div>
      </dl>
    </section>
  )
}
