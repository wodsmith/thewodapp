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

const attemptsByKey = new Map<string, { count: number; resetAt: number }>()

export async function checkBenchmarkOpenJoinRateLimit({
  userId,
  competitionId,
  now = new Date(),
}: BenchmarkOpenJoinRateLimitInput): Promise<BenchmarkOpenJoinRateLimitResult> {
  const key = `${competitionId}:${userId}`
  const nowMs = now.getTime()
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
