import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { HAS_CHAIN, POLL_MS } from '../chain/config'
import { view } from '../chain/rpc'
import { callMira, connectWallet, disconnectWallet, onWalletChange, restoreAccount } from '../chain/wallet'
import type { Config, FeedEvent, LeaderRow, Overview, Player, Quest, QuestDetail } from '../chain/types'

export interface Toast {
  id: number
  kind: 'ok' | 'error' | 'info'
  text: string
}

interface MiraState {
  status: 'loading' | 'live' | 'offline'
  error: string
  overview: Overview | null
  config: Config | null
  quests: QuestDetail[]
  events: FeedEvent[]
  board: LeaderRow[]
  player: Player | null
  account: string | null
  busy: string | null
  toasts: Toast[]
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  send: (label: string, method: string, args?: Record<string, unknown>, deposit?: string) => Promise<boolean>
  refresh: () => Promise<void>
  dismiss: (id: number) => void
}

const Ctx = createContext<MiraState | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useMira(): MiraState {
  const value = useContext(Ctx)
  if (!value) throw new Error('useMira outside provider')
  return value
}

const DETAIL_LIMIT = 8

export function MiraProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MiraState['status']>(HAS_CHAIN ? 'loading' : 'offline')
  const [error, setError] = useState(HAS_CHAIN ? '' : 'No contract address configured (VITE_MIRA_CONTRACT).')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const [quests, setQuests] = useState<QuestDetail[]>([])
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [board, setBoard] = useState<LeaderRow[]>([])
  const [player, setPlayer] = useState<Player | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextToast = useRef(1)
  const settled = useRef(new Map<number, QuestDetail>())
  const accountRef = useRef<string | null>(null)
  useEffect(() => {
    accountRef.current = account
  }, [account])

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = nextToast.current++
    setToasts((list) => [...list.slice(-3), { id, kind, text }])
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 6000)
  }, [])

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const refresh = useCallback(async () => {
    if (!HAS_CHAIN) return
    try {
      const who = accountRef.current
      const [ov, list, evs, lb, me] = await Promise.all([
        view<Overview>('get_overview'),
        view<Quest[]>('list_quests', { from_id: 1, limit: 30 }),
        view<FeedEvent[]>('recent_events', { limit: 30 }),
        view<LeaderRow[]>('get_leaderboard', { limit: 10 }),
        who ? view<Player>('get_player', { account_id: who }) : Promise.resolve(null),
      ])
      // Settled quests never change: fetch them once, then only poll the live ones.
      const details = await Promise.all(
        list.slice(0, DETAIL_LIMIT).map(async (q) => {
          const cached = settled.current.get(q.id)
          if (cached && q.status !== 'ACTIVE') return cached
          const detail = await view<QuestDetail>('get_quest', { id: q.id })
          if (detail.status !== 'ACTIVE') settled.current.set(q.id, detail)
          return detail
        }),
      )
      setOverview(ov)
      setQuests(details)
      setEvents(evs)
      setBoard(lb)
      setPlayer(me)
      setStatus('live')
      setError('')
    } catch (e) {
      setStatus((s) => (s === 'live' ? s : 'offline'))
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (!HAS_CHAIN) return
    view<Config>('get_config').then(setConfig).catch(() => undefined)
  }, [])

  useEffect(() => {
    let alive = true
    restoreAccount().then((id) => alive && setAccount(id))
    const off = onWalletChange((id) => setAccount(id))
    return () => {
      alive = false
      off()
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [refresh, account])

  const connect = useCallback(async () => {
    try {
      const id = await connectWallet()
      if (id) setAccount(id)
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Wallet connection failed')
    }
  }, [toast])

  const disconnect = useCallback(async () => {
    await disconnectWallet()
    setAccount(null)
    setPlayer(null)
  }, [])

  const send = useCallback(
    async (label: string, method: string, args: Record<string, unknown> = {}, deposit = '0') => {
      if (!accountRef.current) {
        toast('info', 'Connect a wallet first')
        return false
      }
      setBusy(label)
      try {
        await callMira(method, args, deposit)
        toast('ok', `${label} — confirmed`)
        await refresh()
        return true
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        toast('error', `${label} failed: ${message.replace(/^Smart contract panicked: /, '').slice(0, 160)}`)
        return false
      } finally {
        setBusy(null)
      }
    },
    [refresh, toast],
  )

  const value = useMemo<MiraState>(
    () => ({
      status, error, overview, config, quests, events, board, player, account, busy, toasts,
      connect, disconnect, send, refresh, dismiss,
    }),
    [status, error, overview, config, quests, events, board, player, account, busy, toasts, connect, disconnect, send, refresh, dismiss],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
