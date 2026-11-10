interface Status {
  Failure?: unknown
}
interface Outcome {
  status?: Status
  receipts_outcome?: { outcome?: { status?: Status } }[]
}

// A wallet may resolve with a failed outcome instead of rejecting. Returns the contract's panic message
// (or a short fallback) when the transaction or any of its receipts failed, otherwise null.
export function failureMessage(outcome: unknown): string | null {
  const o = outcome as Outcome | null | undefined
  const statuses = [o?.status, ...(o?.receipts_outcome ?? []).map((r) => r.outcome?.status)]
  for (const status of statuses) {
    if (!status?.Failure) continue
    const text = JSON.stringify(status.Failure)
    return text.match(/Smart contract panicked: ([^"\\]+)/)?.[1] ?? text.slice(0, 160)
  }
  return null
}
