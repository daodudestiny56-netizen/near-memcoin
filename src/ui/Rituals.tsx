import { useState } from 'react'
import { useMira } from '../state/mira'
import { fmt, shortAccount } from '../chain/format'

export default function Rituals() {
  const { account, player, overview: ov, config, board, send, busy, connect } = useMira()
  const [target, setTarget] = useState('')
  const starving = ov?.mood === 'STARVING'

  return (
    <section className="section" id="rituals">
      <div className="section-head">
        <p className="kicker">03 · Rituals</p>
        <h2>Show up. Keep the streak.</h2>
        <p className="sub">Saying gm once per epoch counts as a beat and builds a streak. A streak of {config?.propose_streak ?? 3} unlocks proposing quests. Miss an epoch and it resets.</p>
      </div>

      <div className="ritual-grid">
        <article className="card player">
          {account && player ? (
            <>
              <header className="card-head">
                <h3>{shortAccount(account, 24)}</h3>
                <span className="chip chip-plain">{fmt(player.balance, 0)} MIRA</span>
              </header>
              <div className="streak">
                <span className="flame" aria-hidden="true">🔥</span>
                <strong className="num">{player.streak}</strong>
                <span>epoch streak <small>best {player.best_streak}</small></span>
              </div>
              <dl className="facts">
                <div><dt>XP</dt><dd className="num">{player.xp}</dd></div>
                <div><dt>Wins</dt><dd className="num">{player.wins}</dd></div>
                <div><dt>Scars</dt><dd className="num">{player.scars}</dd></div>
                <div><dt>Right votes</dt><dd className="num">{player.votes_correct}</dd></div>
              </dl>
              <p className="muted small">Each lost quest leaves a scar, and scars add up to +3 voting weight. Losing well is respected.</p>
              <div className="btn-row">
                <button className="btn btn-primary" disabled={!!busy || !player.gm_available} onClick={() => void send('gm', 'gm')}>
                  {player.gm_available ? 'Say gm' : 'gm done this epoch'}
                </button>
                {ov?.faucet_on && (
                  <button className="btn btn-ghost" disabled={!!busy} onClick={() => void send('Claim test MIRA', 'claim')}>
                    Claim {config?.claim_amount ?? 1000} test MIRA
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="empty-inner">
              <h3>Your ritual card</h3>
              <p className="muted">Connect a wallet to say gm, grab test MIRA and track your scars.</p>
              <button className="btn btn-primary" onClick={() => void connect()}>Connect wallet</button>
            </div>
          )}
        </article>

        <article className={starving ? 'card keeper alarm' : 'card keeper'}>
          <header className="card-head">
            <h3>Starvation keeper</h3>
            <span className={starving ? 'chip chip-alarm' : 'chip chip-plain'}>{starving ? 'MIRA is starving' : 'Not needed'}</span>
          </header>
          <p className="muted">
            When a whole epoch passes quiet, MIRA starves. Anyone can then tax a holder who has been idle for {config?.starve_idle_epochs ?? 2}+
            epochs by {(config?.starve_bps ?? 100) / 100}%. <b>80%</b> feeds the next quest pool, <b>20%</b> is the keeper's bounty.
            Active players, the treasury and the contract are exempt.
          </p>
          <label className="field">
            <span>Idle holder</span>
            <input value={target} onChange={(e) => setTarget(e.target.value.trim())} placeholder="someone.testnet" disabled={!starving} />
          </label>
          {board.length > 0 && starving && (
            <div className="chips">
              {board.slice(0, 5).map((r) => (
                <button key={r.account} className="chip chip-btn" onClick={() => setTarget(r.account)}>{shortAccount(r.account, 16)}</button>
              ))}
            </div>
          )}
          <button
            className="btn btn-dark btn-block"
            disabled={!account || !starving || !target || !!busy}
            onClick={() => void send('Starve idle holder', 'starve', { account_id: target })}
          >
            Feed MIRA
          </button>
        </article>
      </div>
    </section>
  )
}
