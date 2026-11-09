import { useMira } from '../state/mira'
import { NETWORK, USE_MOCK } from '../chain/config'
import { fmt, shortAccount } from '../chain/format'

const LINKS = [
  ['vitals', 'Vitals'],
  ['quests', 'Quests'],
  ['rituals', 'Rituals'],
  ['leaderboard', 'Leaderboard'],
  ['rules', 'How it works'],
] as const

export default function Header() {
  const { account, player, connect, disconnect, busy } = useMira()
  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="MIRA home">
        <span className="brand-coin" aria-hidden="true" />
        <span className="brand-word">MIRA</span>
        <span className="net-badge">{USE_MOCK ? 'preview' : NETWORK}</span>
      </a>
      <nav className="nav" aria-label="Sections">
        {LINKS.map(([id, label]) => (
          <a key={id} href={`#${id}`}>{label}</a>
        ))}
      </nav>
      {account ? (
        <div className="wallet">
          <div className="wallet-info">
            <strong>{shortAccount(account, 20)}</strong>
            {player && <span>{fmt(player.balance, 0)} MIRA</span>}
          </div>
          <button className="btn btn-ghost" onClick={() => void disconnect()} disabled={!!busy}>Sign out</button>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={() => void connect()}>Connect wallet</button>
      )}
    </header>
  )
}
