import { useMira } from '../state/mira'
import type { FeedEvent } from '../chain/types'
import { fmt, nsToMs, shortAccount, timeAgo } from '../chain/format'
import { EVENT_LABEL } from './mood'
import { useNow } from './useNow'

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

function describe(e: FeedEvent): string {
  const d = e.d
  switch (e.k) {
    case 'BURN':
      return `${fmt(str(d.amount))} MIRA destroyed · ${str(d.reason).replace('_', ' ')}`
    case 'GM':
      return `${shortAccount(str(d.account))} said gm · streak ${str(d.streak)}`
    case 'CLAIM':
      return `${shortAccount(str(d.account))} claimed ${fmt(str(d.amount), 0)} test MIRA`
    case 'QUEST_PROPOSED':
      return `#${str(d.id)} “${str(d.title)}” by ${shortAccount(str(d.proposer))}`
    case 'JOINED':
      return `${shortAccount(str(d.account))} entered #${str(d.id)}`
    case 'PROOF':
      return `${shortAccount(str(d.account))} posted proof in #${str(d.id)}`
    case 'VOTE_COMMITTED':
      return `${shortAccount(str(d.account))} sealed a vote in #${str(d.id)}`
    case 'VOTE_REVEALED':
      return `${shortAccount(str(d.account))} revealed a vote in #${str(d.id)}`
    case 'QUEST_RESOLVED':
      return `#${str(d.id)} settled · ${fmt(str(d.burned))} burned`
    case 'QUEST_VOID':
      return `#${str(d.id)} voided · ${str(d.reason)}`
    case 'STARVE':
      return `${shortAccount(str(d.keeper))} taxed ${shortAccount(str(d.account))} ${fmt(str(d.taken))} MIRA`
    default:
      return e.k
  }
}

export default function Feed() {
  const { events, status } = useMira()
  const now = useNow(5000)
  return (
    <section className="section feed-section" id="feed">
      <div className="section-head">
        <p className="kicker">04 · On-chain, right now</p>
        <h2>Live burn feed.</h2>
        <p className="sub">Read straight from the contract's event log. Nothing here is simulated.</p>
      </div>
      <ul className="feed">
        {events.length === 0 && <li className="empty">{status === 'live' ? 'Nothing has happened yet. Say gm to make the first beat.' : 'Waiting for the chain…'}</li>}
        {events.map((e) => (
          <li key={e.i} className={e.k === 'BURN' ? 'burn' : ''}>
            <span className="feed-dot" aria-hidden="true">{e.k === 'BURN' ? '🔥' : '•'}</span>
            <div>
              <b>{EVENT_LABEL[e.k] ?? e.k}</b>
              <span>{describe(e)}</span>
            </div>
            <time>{timeAgo(nsToMs(e.t), now)}</time>
          </li>
        ))}
      </ul>
    </section>
  )
}
