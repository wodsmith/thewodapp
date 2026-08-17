import { getKV } from "@/utils/kv-session"

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
const KV_PREFIX = "rate-limit:benchmark-open-join:"

// Local/test fallback when the Cloudflare KV binding is unavailable.
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
  const kv = getKV()

  if (kv) {
    const kvKey = `${KV_PREFIX}${key}`
    const current = await kv.get<{ count: number; resetAt: number }>(
      kvKey,
      "json",
    )

    if (!current || current.resetAt <= nowMs) {
      const resetAt = nowMs + WINDOW_MS
      await kv.put(kvKey, JSON.stringify({ count: 1, resetAt }), {
        expirationTtl: Math.ceil(WINDOW_MS / 1000),
      })
      return { allowed: true }
    }

    if (current.count >= MAX_ATTEMPTS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((current.resetAt - nowMs) / 1000),
      }
    }

    await kv.put(
      kvKey,
      JSON.stringify({ count: current.count + 1, resetAt: current.resetAt }),
      {
        expirationTtl: Math.max(1, Math.ceil((current.resetAt - nowMs) / 1000)),
      },
    )
    return { allowed: true }
  }

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
