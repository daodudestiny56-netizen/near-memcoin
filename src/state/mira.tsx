import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { HAS_CHAIN, POLL_MS } from '../chain/config'
import { view } from '../chain/rpc'
import { callMira, connectWallet, disconnectWallet, onWalletChange, restoreAccount } from '../chain/wallet'
import type { Config, Dashboard, FeedEvent, LeaderRow, Overview, Player, QuestDetail } from '../chain/types'

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
  refresh: () => Promise<boolean>
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

  // One RPC call per refresh. Returns false when the RPC pushed back (rate limit, outage).
  const refresh = useCallback(async (): Promise<boolean> => {
    if (!HAS_CHAIN) return true
    try {
      const who = accountRef.current
      const d = await view<Dashboard>('get_dashboard', {
        account_id: who ?? undefined,
        quest_limit: DETAIL_LIMIT,
        event_limit: 30,
        board_limit: 10,
      })
      setOverview(d.overview)
      setQuests(d.quests)
      setEvents(d.events)
      setBoard(d.board)
      setPlayer(d.player)
      setStatus('live')
      setError('')
      return true
    } catch (e) {
      setStatus((s) => (s === 'live' ? s : 'offline'))
      setError(e instanceof Error ? e.message : String(e))
      return false
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

  // Poll every POLL_MS; double the wait (up to 8x) after each failure so a throttled RPC recovers.
  useEffect(() => {
    let stopped = false
    const backoff = { failures: 0, timer: 0 }
    const tick = async () => {
      if (!document.hidden) backoff.failures = (await refresh()) ? 0 : Math.min(backoff.failures + 1, 3)
      if (!stopped) backoff.timer = window.setTimeout(() => void tick(), POLL_MS * 2 ** backoff.failures)
    }
    void tick()
    return () => {
      stopped = true
      window.clearTimeout(backoff.timer)
    }
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
        void refresh()
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
