/** Bounds apply across sessions, including SDK retries. Tokens reserve worst-case output. */
export const IMPORT_LIMITS = {
  sourceBytes: 10 * 1024 * 1024,
  sourcePixels: 24_000_000,
  textCharacters: 20_000,
  retentionSeconds: 86_400,
  timeoutMs: 90_000,
  outputTokens: 4096,
  dispatchesPerRun: 2,
  dispatchesPerSession: 12,
  actorDailyDispatches: 30,
  teamDailyDispatches: 150,
  actorDailySessions: 30,
  teamDailySessions: 150,
} as const

export class WorkoutImportRuntimeError extends Error {
  constructor(
    public readonly code:
      | "invalid_source"
      | "source_expired"
      | "rate_limited"
      | "busy"
      | "stale_revision"
      | "cancelled"
      | "timeout"
      | "provider_error"
      | "invalid_output"
      | "access_required",
    public readonly status = 400,
  ) {
    super(code)
  }
}

/** Abort ends local work even when a provider binding ignores AbortSignal. */
export function awaitImportResult<T>(
  work: Promise<T>,
  controller: AbortController,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const aborted = () =>
      reject(
        new WorkoutImportRuntimeError(
          controller.signal.reason === "timeout" ? "timeout" : "cancelled",
          408,
        ),
      )
    if (controller.signal.aborted) {
      aborted()
      return
    }
    controller.signal.addEventListener("abort", aborted, { once: true })
    work
      .then(resolve, reject)
      .finally(() => controller.signal.removeEventListener("abort", aborted))
  })
}

export async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!body) throw new WorkoutImportRuntimeError("invalid_source")
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new WorkoutImportRuntimeError("invalid_source", 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
