// Sealed votes: the choice and salt live only in this browser until the reveal phase.
interface SavedVote {
  entrant: string
  salt: string
}

const key = (id: number, account: string) => `mira:vote:${id}:${account}`

export function saveVote(id: number, account: string, vote: SavedVote) {
  try {
    localStorage.setItem(key(id, account), JSON.stringify(vote))
  } catch {
    // storage unavailable: the user can still reveal by re-entering the salt
  }
}

export function loadVote(id: number, account: string): SavedVote | null {
  try {
    const text = localStorage.getItem(key(id, account))
    return text ? (JSON.parse(text) as SavedVote) : null
  } catch {
    return null
  }
}

export function newSalt(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Must match contract/src/core/settle.js commitPreimage.
export async function commitHash(id: number, voter: string, entrant: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${id}:${voter}:${entrant}:${salt}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
