import { CONTRACT_ID, RPC_URLS } from './config'

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

// Read-only contract call over JSON-RPC. Tries each RPC in turn.
export async function view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  // literal env check so production builds drop the mock entirely
  if (import.meta.env.VITE_MOCK === '1') return (await (await import('./mock')).mockView(method, args)) as T
  if (!CONTRACT_ID) throw new Error('No contract configured')
  let lastError: unknown = new Error('No RPC available')
  for (const url of RPC_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'mira',
          method: 'query',
          params: {
            request_type: 'call_function',
            finality: 'optimistic',
            account_id: CONTRACT_ID,
            method_name: method,
            args_base64: toBase64(JSON.stringify(args)),
          },
        }),
      })
      const json = await response.json()
      if (json.error) throw new Error(json.error.data ?? json.error.message ?? 'RPC error')
      if (json.result?.error) throw new Error(String(json.result.error))
      const bytes = Uint8Array.from(json.result.result as number[])
      return JSON.parse(new TextDecoder().decode(bytes)) as T
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

// How many access keys the contract account has. 0 means nobody can sign as it, so its code cannot be replaced.
export async function accessKeyCount(): Promise<number | null> {
  if (import.meta.env.VITE_MOCK === '1' || !CONTRACT_ID) return null
  for (const url of RPC_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'mira-keys',
          method: 'query',
          params: { request_type: 'view_access_key_list', finality: 'final', account_id: CONTRACT_ID },
        }),
      })
      const json = await response.json()
      if (Array.isArray(json.result?.keys)) return json.result.keys.length
    } catch {
      // try the next RPC
    }
  }
  return null
}
