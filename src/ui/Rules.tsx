import { CONTRACT_ID, EXPLORER } from '../chain/config'
import { useMira } from '../state/mira'

const STEPS = [
  ['Stake', 'Enter a quest by locking its stake in contract escrow. One entry per account.'],
  ['Prove', 'Post a link or note before the entry window closes. No proof, no chance to win.'],
  ['Vote in secret', 'Holders stake to cast a hashed vote. Nobody can see or copy it until the reveal phase.'],
  ['Reveal & settle', 'Votes are opened. The top third of entries win the pool plus their stake back. Anyone can settle.'],
]

export default function Rules() {
  const locked = useMira().overview?.config_locked === true
  return (
    <section className="section rules" id="rules">
      <div className="section-head">
        <p className="kicker">07 · How it works</p>
        <h2>A game loop, not a promise of price.</h2>
        <p className="sub">MIRA is judged on its mechanic. Here is every rule, and every limit.</p>
      </div>

      <ol className="steps">
        {STEPS.map(([title, body], i) => (
          <li key={title}>
            <span className="num">0{i + 1}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </li>
        ))}
      </ol>

      <div className="rules-grid">
        <article className="card">
          <h3>The three mechanics</h3>
          <ul className="ticks">
            <li><b>Heartbeat.</b> Activity per epoch sets MIRA's mood. The mood sets the burn rate of failed stakes, from 60% burned when thriving to 20% when starving.</li>
            <li><b>Starvation.</b> If a whole epoch is quiet, anyone may tax holders who have been idle for two epochs by 1%. It feeds the next quest and pays the keeper 20%.</li>
            <li><b>Secret vote.</b> Commit-reveal voting with stake. Voters who back a winner share the forfeited stakes of voters who didn't.</li>
          </ul>
        </article>

        <article className="card">
          <h3>Why it can't be rugged</h3>
          <ul className="ticks">
            <li>There is no mint function. The full 10,000,000 supply is minted once at deploy; the only way it changes is by burning.</li>
            {locked ? (
              <li><b>Config is locked.</b> The clocks and thresholds were frozen on-chain with <code>lock_config</code>. Nobody, including the owner, can change them now.</li>
            ) : (
              <li>The owner can tune clocks and thresholds until it calls the one-way <code>lock_config</code>. The owner cannot pause, cannot touch escrow, and cannot change the burn splits: they are constants in the code.</li>
            )}
            <li>Every burn, payout and tax is emitted as an event and shown in the live feed.</li>
          </ul>
        </article>

        <article className="card">
          <h3>Honest limits</h3>
          <ul className="ticks warn">
            <li>This is a hackathon build on testnet. The faucet is for demos and the contract is unaudited.</li>
            <li>One account is one vote, so a determined attacker with many funded accounts can sway a quest. Stakes make it costly, not impossible.</li>
            <li>Starvation tax is a real holder cost by design. DEX and treasury accounts can be exempted by the owner.</li>
          </ul>
        </article>
      </div>

      {CONTRACT_ID && (
        <p className="contract-line">
          Contract <a href={`${EXPLORER}/address/${CONTRACT_ID}`} target="_blank" rel="noreferrer">{CONTRACT_ID}</a> · NEP-141 · source on{' '}
          <a href="https://github.com/daodudestiny56-netizen/near-memcoin" target="_blank" rel="noreferrer">GitHub</a>
        </p>
      )}
    </section>
  )
}
