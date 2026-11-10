import { NearConnector } from '@hot-labs/near-connect'
import { CONTRACT_ID, GAS, NETWORK, USE_MOCK } from './config'
import { failureMessage } from './outcome'

interface ConnectedWallet {
  getAccounts(): Promise<{ accountId: string }[]>
  signAndSendTransaction(tx: {
    receiverId: string
    actions: {
      type: 'FunctionCall'
      params: { methodName: string; args: Record<string, unknown>; gas: string; deposit: string }
    }[]
  }): Promise<unknown>
}

// Recording-only signer (VITE_DEMO_SIGNER=1): a headless browser can't operate a wallet popup, so
// the demo harness injects window.__miraDemo and signs with throwaway TESTNET keys in Node.
// The literal env checks below let Vite remove all of it from normal builds.
interface MiraDemo {
  account: string | null
  pending: string | null
  send: (account: string, method: string, args: Record<string, unknown>, deposit: string) => Promise<void>
}
declare global {
  interface Window {
    __miraDemo?: MiraDemo
  }
}

let connector: NearConnector | null = null

function getConnector(): NearConnector {
  if (!connector) connector = new NearConnector({ network: NETWORK })
  return connector
}

const MOCK_ACCOUNT = 'you.testnet'
let mockSignedIn = false

export async function restoreAccount(): Promise<string | null> {
  if (import.meta.env.VITE_DEMO_SIGNER === '1') return window.__miraDemo?.account ?? null
  if (USE_MOCK) return mockSignedIn ? MOCK_ACCOUNT : null
  try {
    const wallet = (await getConnector().wallet()) as unknown as ConnectedWallet
    const accounts = await wallet.getAccounts()
    return accounts[0]?.accountId ?? null
  } catch {
    return null
  }
}

export async function connectWallet(): Promise<string | null> {
  if (import.meta.env.VITE_DEMO_SIGNER === '1') {
    const demo = window.__miraDemo
    if (!demo?.pending) return null
    demo.account = demo.pending
    return demo.account
  }
  if (USE_MOCK) {
    mockSignedIn = true
    return MOCK_ACCOUNT
  }
  const wallet = (await getConnector().connect()) as unknown as ConnectedWallet
  const accounts = await wallet.getAccounts()
  return accounts[0]?.accountId ?? null
}

export async function disconnectWallet(): Promise<void> {
  if (import.meta.env.VITE_DEMO_SIGNER === '1' && window.__miraDemo) window.__miraDemo.account = null
  mockSignedIn = false
  if (USE_MOCK) return
  try {
    const wallet = await getConnector().wallet()
    await getConnector().disconnect(wallet)
  } catch {
    // already signed out
  }
}

export function onWalletChange(handler: (account: string | null) => void): () => void {
  if (import.meta.env.VITE_DEMO_SIGNER === '1') return () => undefined
  if (USE_MOCK) return () => undefined
  const c = getConnector()
  const signIn = (payload: { accounts?: { accountId: string }[] }) => handler(payload.accounts?.[0]?.accountId ?? null)
  const signOut = () => handler(null)
  c.on('wallet:signIn', signIn as never)
  c.on('wallet:signOut', signOut as never)
  return () => {
    c.off('wallet:signIn', signIn as never)
    c.off('wallet:signOut', signOut as never)
  }
}

// Sends one FunctionCall to the MIRA contract through the connected wallet.
export async function callMira(
  methodName: string,
  args: Record<string, unknown> = {},
  deposit = '0',
): Promise<void> {
  if (import.meta.env.VITE_DEMO_SIGNER === '1') {
    const demo = window.__miraDemo
    if (!demo?.account) throw new Error('No demo account signed in')
    return demo.send(demo.account, methodName, args, deposit)
  }
  if (import.meta.env.VITE_MOCK === '1') return (await import('./mock')).mockCall(methodName, args)
  const wallet = (await getConnector().wallet()) as unknown as ConnectedWallet
  const outcome = await wallet.signAndSendTransaction({
    receiverId: CONTRACT_ID,
    actions: [{ type: 'FunctionCall', params: { methodName, args, gas: GAS, deposit } }],
  })
  const failure = failureMessage(outcome)
  if (failure) throw new Error(failure)
}
