import { MiraProvider, useMira } from './state/mira'
import Header from './ui/Header'
import Hero from './ui/Hero'
import Vitals from './ui/Vitals'
import Quests from './ui/Quests'
import Rituals from './ui/Rituals'
import Feed from './ui/Feed'
import Leaderboard from './ui/Leaderboard'
import Rules from './ui/Rules'
import { CONTRACT_ID, EXPLORER, NETWORK } from './chain/config'

function Toasts() {
  const { toasts, dismiss, busy } = useMira()
  return (
    <div className="toasts" aria-live="polite">
      {busy && <div className="toast info"><span className="spin" /> {busy}…</div>}
      {toasts.map((t) => (
        <button key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>{t.text}</button>
      ))}
    </div>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div>
        <strong>MIRA</strong>
        <p>A memecoin with a point. Built for the NEAR Hackathon, Memecoins With Mechanics track.</p>
      </div>
      <div className="footer-links">
        {CONTRACT_ID && <a href={`${EXPLORER}/address/${CONTRACT_ID}`} target="_blank" rel="noreferrer">Contract on {NETWORK}</a>}
        <a href="https://github.com/daodudestiny56-netizen/near-memcoin" target="_blank" rel="noreferrer">Source code</a>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <MiraProvider>
      <div className="shell">
        <Header />
        <main>
          <Hero />
          <Vitals />
          <Quests />
          <Rituals />
          <Feed />
          <Leaderboard />
          <Rules />
        </main>
        <Footer />
      </div>
      <Toasts />
    </MiraProvider>
  )
}
