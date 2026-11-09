import { NearConnector } from '@hot-labs/near-connect'
import { CONTRACT_ID, GAS, NETWORK, USE_MOCK } from './config'

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

let connector: NearConnector | null = null

function getConnector(): NearConnector {
  if (!connector) connector = new NearConnector({ network: NETWORK })
  return connector
}

const MOCK_ACCOUNT = 'you.testnet'
let mockSignedIn = false

export async function restoreAccount(): Promise<string | null> {
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
  if (USE_MOCK) {
    mockSignedIn = true
    return MOCK_ACCOUNT
  }
  const wallet = (await getConnector().connect()) as unknown as ConnectedWallet
  const accounts = await wallet.getAccounts()
  return accounts[0]?.accountId ?? null
}

export async function disconnectWallet(): Promise<void> {
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
  if (USE_MOCK) return (await import('./mock')).mockCall(methodName, args)
  const wallet = (await getConnector().wallet()) as unknown as ConnectedWallet
  await wallet.signAndSendTransaction({
    receiverId: CONTRACT_ID,
    actions: [{ type: 'FunctionCall', params: { methodName, args, gas: GAS, deposit } }],
  })
}
