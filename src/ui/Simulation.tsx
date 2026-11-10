const REPO = 'https://github.com/daodudestiny56-netizen/near-memcoin'

// The chart is produced by `npm run sim` in contract/, which drives the real contract rules.
export default function Simulation() {
  return (
    <section className="section" id="simulation">
      <div className="section-head">
        <p className="kicker">06 · Evidence</p>
        <h2>Sixty days, four communities.</h2>
        <p className="sub">
          The same rules the contract runs, driven by simulated players. Re-run it yourself; the seed is fixed.
        </p>
      </div>
      <div className="card sim-card">
        <img
          className="sim-chart"
          src="/simulation.svg"
          alt="Line charts of circulating supply and cumulative burn over 60 days for thriving, fading, quiet and sybil-ring communities"
          loading="lazy"
        />
        <ul className="ticks">
          <li><b>Activity sets the burn.</b> The thriving community burned about 6,900 MIRA in 60 days. The quiet one burned nothing.</li>
          <li><b>A quiet coin is taxed, not burned.</b> With nobody proposing quests, the starvation tax just parks about 9,800 MIRA in the quest pool. That is a real weakness, and it is in the README.</li>
          <li><b>A sybil ring wins quests but loses money.</b> 12 colluding accounts took about 80% of wins from 67% of entries, and still lost about 5,600 MIRA, because every losing entry forfeits its stake.</li>
        </ul>
        <p className="contract-line">
          Source: <a href={`${REPO}/tree/main/contract/sim`} target="_blank" rel="noreferrer">contract/sim</a> · run <code>cd contract &amp;&amp; npm run sim</code>
        </p>
      </div>
    </section>
  )
}
