// Deployment settings. Override at build time with VITE_* variables.
export const NETWORK = (import.meta.env.VITE_NEAR_NETWORK as 'testnet' | 'mainnet' | undefined) ?? 'testnet'
export const CONTRACT_ID = (import.meta.env.VITE_MIRA_CONTRACT as string | undefined) ?? ''
export const RPC_URLS: string[] = (
  (import.meta.env.VITE_NEAR_RPC as string | undefined)?.split(',') ??
  (NETWORK === 'mainnet'
    ? ['https://rpc.mainnet.fastnear.com', 'https://rpc.mainnet.near.org']
    : ['https://rpc.testnet.fastnear.com', 'https://rpc.testnet.near.org'])
).map((u) => u.trim())
export const EXPLORER =
  NETWORK === 'mainnet' ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io'
export const USE_MOCK = import.meta.env.VITE_MOCK === '1'
export const HAS_CHAIN = USE_MOCK || CONTRACT_ID !== ''
export const POLL_MS = 4000
export const DECIMALS = 18
export const GAS = '300000000000000'
