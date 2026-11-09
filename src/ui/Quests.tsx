import { useState } from 'react'
import { useMira } from '../state/mira'
import type { Phase, QuestDetail } from '../chain/types'
import { countdown, fmt, nsToMs, parseTokens, shortAccount } from '../chain/format'
import { commitHash, loadVote, newSalt, saveVote } from './vote'
import { useNow } from './useNow'
import { EXPLORER } from '../chain/config'

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'SUBMIT', label: 'Enter' },
  { phase: 'COMMIT', label: 'Vote' },
  { phase: 'REVEAL', label: 'Reveal' },
  { phase: 'SETTLE', label: 'Settle' },
]

function Timeline({ q, now }: { q: QuestDetail; now: number }) {
  const ends = [nsToMs(q.submit_end), nsToMs(q.commit_end), nsToMs(q.reveal_end)]
  const index = q.status !== 'ACTIVE' ? 4 : STEPS.findIndex((s) => s.phase === q.phase)
  const left = index < 3 ? ends[index] - now : 0
  return (
    <div className="timeline">
      <ol>
        {STEPS.map((s, i) => (
          <li key={s.phase} className={i < index ? 'done' : i === index ? 'now' : ''}>
            <i />
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="phase-note">
        {q.status === 'RESOLVED' && 'Settled on-chain'}
        {q.status === 'VOID' && 'Voided · everyone refunded'}
        {q.status === 'ACTIVE' && index < 3 && <>Closes in <b>{countdown(left)}</b></>}
        {q.status === 'ACTIVE' && index === 3 && <b>Ready to settle</b>}
      </p>
    </div>
  )
}

function isUrl(text: string) {
  return /^https?:\/\//i.test(text)
}

function Actions({ q }: { q: QuestDetail }) {
  const { account, send, busy, connect } = useMira()
  const [proof, setProof] = useState('')
  const [choice, setChoice] = useState('')
  const mine = q.entries.find((e) => e.account === account)
  const myVote = q.votes.find((v) => v.account === account)
  const saved = account ? loadVote(q.id, account) : null

  if (q.status === 'RESOLVED' && q.result) {
    return (
      <div className="result">
        <p><b>Winners</b> {q.result.winners?.map((w) => shortAccount(w)).join(', ')}</p>
        <p>
          <span className="burn-text">{fmt(q.result.burned, 2)} MIRA burned</span> ·{' '}
          {fmt(q.result.rolled_over, 2)} to the next pool · {q.result.correct_voters} voters rewarded
        </p>
      </div>
    )
  }
  if (q.status === 'VOID') return <p className="result">{q.result?.reason ?? 'No result'}. Stakes returned, pool rolled over.</p>

  if (!account) {
    return <button className="btn btn-primary btn-block" onClick={() => void connect()}>Connect wallet to play</button>
  }

  if (q.phase === 'SUBMIT') {
    if (!mine) {
      return (
        <button className="btn btn-primary btn-block" disabled={!!busy} onClick={() => void send('Join quest', 'join_quest', { id: q.id })}>
          Stake {fmt(q.stake)} MIRA to enter
        </button>
      )
    }
    return (
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (proof.trim()) void send('Submit proof', 'submit_proof', { id: q.id, proof: proof.trim() }).then((ok) => ok && setProof(''))
        }}
      >
        <label className="field">
          <span>{mine.proof ? 'Update your proof' : 'Your proof (link or text)'}</span>
          <input value={proof} onChange={(e) => setProof(e.target.value)} maxLength={280} placeholder={mine.proof ?? 'https://…'} />
        </label>
        <button className="btn btn-primary btn-block" disabled={!!busy || !proof.trim()}>
          {mine.proof ? 'Replace proof' : 'Submit proof'}
        </button>
      </form>
    )
  }

  if (q.phase === 'COMMIT') {
    if (myVote || saved) {
      return <p className="sealed">🔒 Your vote is sealed. Come back in the reveal phase.</p>
    }
    const options = q.entries.filter((e) => e.proof && e.account !== account)
    if (options.length === 0) return <p className="muted">No entries with proof to vote on.</p>
    return (
      <div className="stack">
        <p className="muted small">Pick the best entry. Your choice is hashed, nobody can see it until reveal.</p>
        <div className="choices">
          {options.map((e) => (
            <label key={e.account} className={choice === e.account ? 'choice on' : 'choice'}>
              <input type="radio" name={`vote-${q.id}`} checked={choice === e.account} onChange={() => setChoice(e.account)} />
              <span>{shortAccount(e.account)}</span>
            </label>
          ))}
        </div>
        <button
          className="btn btn-primary btn-block"
          disabled={!!busy || !choice}
          onClick={async () => {
            const salt = newSalt()
            const commit = await commitHash(q.id, account, choice, salt)
            saveVote(q.id, account, { entrant: choice, salt })
            const ok = await send('Seal vote', 'commit_vote', { id: q.id, commit })
            if (!ok) localStorage.removeItem(`mira:vote:${q.id}:${account}`)
          }}
        >
          Stake {fmt(q.vote_stake)} MIRA and seal vote
        </button>
      </div>
    )
  }

  if (q.phase === 'REVEAL') {
    if (myVote?.revealed) return <p className="sealed">✓ Revealed. Waiting for settlement.</p>
    if (saved && myVote) {
      return (
        <button
          className="btn btn-primary btn-block"
          disabled={!!busy}
          onClick={() => void send('Reveal vote', 'reveal_vote', { id: q.id, entrant: saved.entrant, salt: saved.salt })}
        >
          Reveal my vote
        </button>
      )
    }
    return <p className="muted">{myVote ? 'Your sealed vote is not stored in this browser, so it cannot be revealed here.' : 'Voting is over. Reveals are open for sealed votes.'}</p>
  }

  return (
    <button className="btn btn-primary btn-block" disabled={!!busy} onClick={() => void send('Settle quest', 'resolve_quest', { id: q.id })}>
      Settle quest (anyone can)
    </button>
  )
}

function QuestCard({ q }: { q: QuestDetail }) {
  const now = useNow()
  const [open, setOpen] = useState(false)
  return (
    <article className={`card quest phase-${q.status === 'ACTIVE' ? q.phase.toLowerCase() : q.status.toLowerCase()}`}>
      <header className="quest-head">
        <span className="quest-id">Quest #{q.id}</span>
        <span className="chip chip-plain">{q.status === 'ACTIVE' ? q.phase === 'SUBMIT' ? 'Open' : q.phase === 'COMMIT' ? 'Voting' : q.phase === 'REVEAL' ? 'Revealing' : 'Settle' : q.status === 'RESOLVED' ? 'Settled' : 'Void'}</span>
      </header>
      <h3>{q.title}</h3>
      <p className="desc">{q.description || 'No description.'}</p>
      <dl className="facts">
        <div><dt>Pool</dt><dd className="num">{fmt(q.pool, 0)}</dd></div>
        <div><dt>Stake</dt><dd className="num">{fmt(q.stake)}</dd></div>
        <div><dt>Entries</dt><dd className="num">{q.entrants}</dd></div>
        <div><dt>Votes</dt><dd className="num">{q.voters}</dd></div>
      </dl>
      <Timeline q={q} now={now} />
      <Actions q={q} />
      {q.entries.length > 0 && (
        <>
          <button className="link" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Hide' : 'Show'} entries ({q.entries.length})
          </button>
          {open && (
            <ul className="entries">
              {q.entries.map((e) => (
                <li key={e.account}>
                  <a href={`${EXPLORER}/address/${e.account}`} target="_blank" rel="noreferrer">{shortAccount(e.account)}</a>
                  {e.proof ? (isUrl(e.proof) ? <a href={e.proof} target="_blank" rel="noreferrer noopener">{e.proof.replace(/^https?:\/\//, '').slice(0, 34)}</a> : <span>{e.proof.slice(0, 40)}</span>) : <em>no proof yet</em>}
                  {q.status !== 'ACTIVE' && <b>{e.tally} votes</b>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <footer className="quest-foot">by {shortAccount(q.proposer)}</footer>
    </article>
  )
}

// submit / commit / reveal window lengths in seconds
const PRESETS = [
  { label: 'Lightning · 3 × 2 min', submit: 120, commit: 120, reveal: 120 },
  { label: 'Relaxed entry · 5 + 2.5 + 2.5 min', submit: 300, commit: 150, reveal: 150 },
  { label: 'Standard · 3 × 1 hour', submit: 3600, commit: 3600, reveal: 3600 },
  { label: 'Daily · 3 × 8 hours', submit: 28800, commit: 28800, reveal: 28800 },
]

function ProposeModal({ onClose }: { onClose: () => void }) {
  const { send, busy, player, config } = useMira()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stake, setStake] = useState('10')
  const [seed, setSeed] = useState('0')
  // Only offer paces the deployment allows (a contract's min_phase_s may exceed the shortest preset).
  const presets = PRESETS.filter((p) => Math.min(p.submit, p.commit, p.reveal) >= (config?.min_phase_s ?? 60))
  const [preset, setPreset] = useState(0)
  const need = config?.propose_streak ?? 3
  const streak = player?.streak ?? 0
  const stakeRaw = parseTokens(stake)
  const seedRaw = parseTokens(seed)
  const valid = title.trim().length >= 3 && stakeRaw !== null && seedRaw !== null && streak >= need

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Propose a quest" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <p className="kicker">Burn to propose</p>
        <h3>Start a quest</h3>
        <p className="muted small">
          Proposing burns <b>{config?.propose_burn ?? 50} MIRA</b> forever and needs a gm streak of {need}
          {' '}(yours: {streak}). The pool starts with any failed stakes rolled over from earlier quests.
        </p>
        <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Touch grass" /></label>
        <label className="field"><span>What counts as proof?</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} rows={3} placeholder="Post a photo from your local park." /></label>
        <div className="two">
          <label className="field"><span>Entry stake (MIRA)</span><input value={stake} onChange={(e) => setStake(e.target.value)} inputMode="decimal" /></label>
          <label className="field"><span>Seed the pool (MIRA)</span><input value={seed} onChange={(e) => setSeed(e.target.value)} inputMode="decimal" /></label>
        </div>
        <fieldset className="presets">
          <legend>Pace</legend>
          {presets.map((p, i) => (
            <label key={p.label} className={preset === i ? 'choice on' : 'choice'}>
              <input type="radio" name="pace" checked={preset === i} onChange={() => setPreset(i)} />
              <span>{p.label}</span>
            </label>
          ))}
        </fieldset>
        <button
          className="btn btn-primary btn-block"
          disabled={!!busy || !valid}
          onClick={async () => {
            const pace = presets[preset]
            const ok = await send('Propose quest', 'propose_quest', {
              title: title.trim(), description: description.trim(), stake: stakeRaw, seed: seedRaw,
              submit_s: pace.submit, commit_s: pace.commit, reveal_s: pace.reveal,
            })
            if (ok) onClose()
          }}
        >
          Burn {config?.propose_burn ?? 50} MIRA and open the quest
        </button>
        {streak < need && <p className="inline-error">Say gm {need - streak} more epoch{need - streak === 1 ? '' : 's'} in a row to unlock proposing.</p>}
      </div>
    </div>
  )
}

export default function Quests() {
  const { quests, status, account, connect } = useMira()
  const [proposing, setProposing] = useState(false)
  const live = quests.filter((q) => q.status === 'ACTIVE')
  const done = quests.filter((q) => q.status !== 'ACTIVE')

  return (
    <section className="section" id="quests">
      <div className="section-head row">
        <div>
          <p className="kicker">02 · Quests</p>
          <h2>Stake. Prove. Vote in secret.</h2>
          <p className="sub">Top third of entries win the pool and their stake back. Everyone else is burned, rolled over, or paid to the voters who backed a winner.</p>
        </div>
        <button className="btn btn-dark" onClick={() => (account ? setProposing(true) : void connect())}>
          {account ? 'Propose a quest' : 'Connect to propose'}
        </button>
      </div>

      {status !== 'live' && quests.length === 0 && <div className="empty">{status === 'loading' ? 'Loading quests from NEAR…' : 'Quests will appear once the contract is reachable.'}</div>}
      {status === 'live' && quests.length === 0 && <div className="empty">No quests yet. Say gm for a few epochs, then burn to propose the first one.</div>}

      {live.length > 0 && <div className="quest-grid">{live.map((q) => <QuestCard key={q.id} q={q} />)}</div>}
      {done.length > 0 && (
        <>
          <h3 className="sub-head">Settled</h3>
          <div className="quest-grid">{done.map((q) => <QuestCard key={q.id} q={q} />)}</div>
        </>
      )}
      {proposing && <ProposeModal onClose={() => setProposing(false)} />}
    </section>
  )
}
