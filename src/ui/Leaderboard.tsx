import { useMira } from '../state/mira'
import { shortAccount } from '../chain/format'

export default function Leaderboard() {
  const { board, account } = useMira()
  return (
    <section className="section" id="leaderboard">
      <div className="section-head">
        <p className="kicker">05 · Reputation</p>
        <h2>Leaderboard.</h2>
        <p className="sub">XP comes from winning, voting right and showing up. Scars are earned by losing, and add voting weight.</p>
      </div>
      <div className="card table-card">
        <table className="board">
          <thead>
            <tr><th>#</th><th>Player</th><th>XP</th><th>Wins</th><th>Scars</th><th>Streak</th></tr>
          </thead>
          <tbody>
            {board.length === 0 && <tr><td colSpan={6} className="empty">No players yet. Be the first to say gm.</td></tr>}
            {board.map((r, i) => (
              <tr key={r.account} className={r.account === account ? 'me' : ''}>
                <td>{i + 1}</td>
                <td><span className="avatar" aria-hidden="true">{r.account[0]?.toUpperCase()}</span>{shortAccount(r.account, 24)}{r.account === account && <em> you</em>}</td>
                <td className="num">{r.xp.toLocaleString('en-US')}</td>
                <td className="num">{r.wins}</td>
                <td><span className="scars" title={`${r.scars} scars`}>{'/'.repeat(Math.min(r.scars, 8)) || '–'}</span></td>
                <td className="num">{r.streak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
