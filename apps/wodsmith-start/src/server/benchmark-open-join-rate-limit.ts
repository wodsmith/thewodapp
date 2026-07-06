interface BenchmarkOpenJoinRateLimitInput {
  userId: string
  competitionId: string
  now?: Date
}

interface BenchmarkOpenJoinRateLimitResult {
  allowed: boolean
  retryAfterSeconds?: number
}

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 10
const PRUNE_THRESHOLD = 1_000

// Per-isolate in-memory limiter: Cloudflare Workers isolates don't share
// memory, so this only bounds attempts within a single isolate and resets on
// isolate recycle. Acceptable as a soft guard for open-join spam; a shared
// store (KV/Durable Object) would be needed for strict global enforcement.
const attemptsByKey = new Map<string, { count: number; resetAt: number }>()

function pruneExpiredEntries(nowMs: number) {
  for (const [key, entry] of attemptsByKey) {
    if (entry.resetAt <= nowMs) {
      attemptsByKey.delete(key)
    }
  }
}

export async function checkBenchmarkOpenJoinRateLimit({
  userId,
  competitionId,
  now = new Date(),
}: BenchmarkOpenJoinRateLimitInput): Promise<BenchmarkOpenJoinRateLimitResult> {
  const key = `${competitionId}:${userId}`
  const nowMs = now.getTime()

  if (attemptsByKey.size >= PRUNE_THRESHOLD) {
    pruneExpiredEntries(nowMs)
  }

  const current = attemptsByKey.get(key)

  if (!current || current.resetAt <= nowMs) {
    attemptsByKey.set(key, { count: 1, resetAt: nowMs + WINDOW_MS })
    return { allowed: true }
  }

  if (current.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.resetAt - nowMs) / 1000),
    }
  }

  current.count += 1
  return { allowed: true }
}

export function resetBenchmarkOpenJoinRateLimitForTests() {
  attemptsByKey.clear()
}
