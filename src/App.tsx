import { useMemo, useState } from 'react'
import './App.css'

type Quest = {
  id: number
  title: string
  description: string
  category: string
  reward: string
  stake: string
  participants: number
  progress: number
  status: 'LIVE' | 'ENDING SOON'
  accent: string
}

const quests: Quest[] = [
  {
    id: 1,
    title: 'Touch grass',
    description: 'Post a photo from your local park. The community votes on the most wholesome proof.',
    category: 'COMMUNITY',
    reward: '1,250 $MIRA',
    stake: '25 $MIRA',
    participants: 64,
    progress: 72,
    status: 'LIVE',
    accent: 'mint',
  },
  {
    id: 2,
    title: 'Meme the market',
    description: 'Explain today’s market move in one meme. Clarity wins, doomposting burns.',
    category: 'CREATIVE',
    reward: '800 $MIRA',
    stake: '10 $MIRA',
    participants: 31,
    progress: 48,
    status: 'LIVE',
    accent: 'lilac',
  },
  {
    id: 3,
    title: 'Bring one friend',
    description: 'Introduce a new builder to the MIRA community and help them complete their first quest.',
    category: 'GROWTH',
    reward: '600 $MIRA',
    stake: '5 $MIRA',
    participants: 18,
    progress: 91,
    status: 'ENDING SOON',
    accent: 'peach',
  },
]

function App() {
  const [connected, setConnected] = useState(false)
  const [activeTab, setActiveTab] = useState('quests')
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null)
  const [joined, setJoined] = useState<number[]>([])
  const [toast, setToast] = useState('')

  const totalStaked = useMemo(() => joined.length * 25, [joined])

  const connectWallet = () => {
    setConnected((value) => !value)
    setToast(connected ? 'Wallet disconnected' : 'Wallet connected: mira-builder.testnet')
    window.setTimeout(() => setToast(''), 2600)
  }

  const joinQuest = (quest: Quest) => {
    if (!joined.includes(quest.id)) {
      setJoined((current) => [...current, quest.id])
      setToast(`Joined “${quest.title}” · ${quest.stake} locked in escrow`)
      window.setTimeout(() => setToast(''), 3000)
    }
    setSelectedQuest(null)
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">◒</span>
          <span>MIRA<span className="brand-dot">.</span></span>
        </a>
        <div className="nav-links">
          <button className={activeTab === 'quests' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('quests')}>Quests</button>
          <button className={activeTab === 'leaderboard' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
          <button className={activeTab === 'how' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('how')}>How it works</button>
        </div>
        <button className="wallet-button" onClick={connectWallet}>
          <span className={connected ? 'status-dot online' : 'status-dot'} />
          {connected ? 'mira-builder.testnet' : 'Connect wallet'}
        </button>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> ON-CHAIN COMMUNITY EXPERIMENT</div>
          <h1>A memecoin<br /><em>with a point.</em></h1>
          <p className="hero-lede">MIRA grows when the community shows up. Complete quests, stake on your proof, and shape the supply together.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => document.getElementById('quests')?.scrollIntoView({ behavior: 'smooth' })}>Explore quests <span>↘</span></button>
            <button className="text-button" onClick={() => setActiveTab('how')}>Read the rules <span>→</span></button>
          </div>
        </div>
        <div className="coin-wrap" aria-label="MIRA coin illustration">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="coin"><span>m</span></div>
          <div className="coin-label label-top">SUPPLY IS A<br /><b>SHARED STORY</b></div>
          <div className="coin-label label-bottom">BUILT ON<br /><b>NEAR</b></div>
        </div>
      </section>

      <section className="stats-strip">
        <div><span className="stat-label">TOTAL SUPPLY</span><strong>10,000,000 <small>$MIRA</small></strong></div>
        <div><span className="stat-label">IN CIRCULATION</span><strong>6,842,100 <small>$MIRA</small></strong></div>
        <div><span className="stat-label">COMMUNITY TREASURY</span><strong>1,204,880 <small>$MIRA</small></strong></div>
        <div><span className="stat-label">QUESTS COMPLETED</span><strong>2,481</strong></div>
      </section>

      {activeTab === 'quests' && (
        <section className="content-section" id="quests">
          <div className="section-heading">
            <div><span className="section-kicker">01 / PARTICIPATE</span><h2>Live quests</h2></div>
            <div className="quest-meta"><span className="pulse-ring" /> {quests.length} active now <span className="divider" /> Your stake: <b>{totalStaked} $MIRA</b></div>
          </div>
          <div className="quest-grid">
            {quests.map((quest) => {
              const isJoined = joined.includes(quest.id)
              return (
                <article className={`quest-card ${quest.accent}`} key={quest.id}>
                  <div className="card-top"><span className="category">{quest.category}</span><span className={quest.status === 'LIVE' ? 'quest-status' : 'quest-status ending'}>{quest.status}</span></div>
                  <h3>{quest.title}</h3>
                  <p>{quest.description}</p>
                  <div className="progress-row"><span>COMMUNITY PROGRESS</span><b>{quest.progress}%</b></div>
                  <div className="progress-track"><div style={{ width: `${quest.progress}%` }} /></div>
                  <div className="card-details"><div><span>REWARD POOL</span><b>{quest.reward}</b></div><div><span>PARTICIPANTS</span><b>{quest.participants}</b></div></div>
                  <button className={isJoined ? 'join-button joined' : 'join-button'} onClick={() => isJoined ? setToast('You are already in this quest') : setSelectedQuest(quest)}>{isJoined ? '✓ Joined quest' : 'View quest'} <span>↗</span></button>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {activeTab === 'leaderboard' && <section className="content-section simple-panel"><span className="section-kicker">02 / REPUTATION</span><h2>Community leaderboard</h2><p>Every completed quest increases your reputation. The first 100 builders share 5% of the community treasury at season end.</p><div className="leader-row"><b>01</b><span className="avatar">K</span><strong>kaito.near</strong><span>42 quests</span><b>12,480 XP</b></div><div className="leader-row"><b>02</b><span className="avatar peach-avatar">S</span><strong>sunny.testnet</strong><span>37 quests</span><b>10,920 XP</b></div><div className="leader-row"><b>03</b><span className="avatar lilac-avatar">M</span><strong>mira-builder.testnet</strong><span>{joined.length} quests</span><b>{joined.length * 420} XP</b></div></section>}

      {activeTab === 'how' && <section className="content-section simple-panel rules"><span className="section-kicker">03 / THE MECHANIC</span><h2>Memes with mechanics.</h2><p>MIRA is not a promise of price. It is a transparent game loop where participation changes what the token can do.</p><div className="rule-grid"><div><span>01</span><h3>Stake to enter</h3><p>Lock a small amount of MIRA in a quest escrow. No wallet custody, no hidden fees.</p></div><div><span>02</span><h3>Prove your work</h3><p>Submit a link, image, or on-chain action before the deadline.</p></div><div><span>03</span><h3>Win or burn</h3><p>Winners receive the pool. Failed stakes are burned, making every action affect supply.</p></div></div></section>}

      <footer><span>© 2026 MIRA COMMUNITY</span><span>QUEST CONTRACT · TESTNET</span><span>BUILT WITH <b>NEAR</b></span></footer>

      {selectedQuest && <div className="modal-backdrop" onClick={() => setSelectedQuest(null)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelectedQuest(null)}>×</button><span className="section-kicker">{selectedQuest.category} QUEST</span><h2>{selectedQuest.title}</h2><p>{selectedQuest.description}</p><div className="stake-callout"><span>YOUR STAKE</span><b>{selectedQuest.stake}</b><small>Returned if your proof wins · burned if it doesn't</small></div><button className="primary-button full" onClick={() => joinQuest(selectedQuest)}>Stake & join quest <span>↗</span></button><small className="modal-note">Demo mode · NEAR testnet wallet integration coming next</small></div></div>}
      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}

export default App
