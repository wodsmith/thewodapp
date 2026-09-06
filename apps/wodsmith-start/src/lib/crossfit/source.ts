import { z } from "zod"

export const CROSSFIT_TRACK_ID = "ptrk_crossfit_dotcom"
export const CROSSFIT_OWNER_TEAM_ID = "team_cokkpu1klwo0ulfhl1iwzpvn"
export const CROSSFIT_CRON = "0 13 * * *"
export const CROSSFIT_PARSER_VERSION = "1"
const MAX_SOURCE_BYTES = 256_000

export const sourceDateSchema = z
  .string()
  .regex(/^20\d{2}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    )
  }, "Invalid calendar date")

export class CrossFitSourceError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
    public readonly retryAfterSeconds = 0,
  ) {
    super(message)
    this.name = "CrossFitSourceError"
  }
}

export function crossFitSourceUrl(date: string) {
  return `https://www.crossfit.com/${sourceDateSchema.parse(date).replaceAll("-", "").slice(2)}`
}

// @lat: [[crossfit-import#CrossFit Daily Import#Schedule]]
export function crossFitScheduledDate(scheduledTime: number) {
  return sourceDateSchema.parse(
    new Date(scheduledTime - 8 * 60 * 60 * 1000).toISOString().slice(0, 10),
  )
}

const responseSchema = z.object({
  wods: z.object({
    id: z.string().min(1),
    cleanID: z.string(),
    url: z.string(),
    language: z.literal("en"),
    publishingState: z.string(),
    wodRaw: z.string().min(1).max(60_000),
    modified: z.string().min(1),
  }),
})

export interface CrossFitSource {
  date: string
  url: string
  sourceId: string
  modified: string
  markdown: string
  hash: string
}

export async function parseCrossFitResponse(
  value: unknown,
  date: string,
): Promise<CrossFitSource> {
  const parsed = responseSchema.safeParse(value)
  if (!parsed.success)
    throw new CrossFitSourceError(
      "CrossFit response schema changed or content is missing",
    )
  const { wods } = parsed.data
  if (
    wods.cleanID !== sourceDateSchema.parse(date).replaceAll("-", "") ||
    wods.url !== new URL(crossFitSourceUrl(date)).pathname
  ) {
    throw new CrossFitSourceError("CrossFit returned a different source date")
  }
  if (wods.publishingState !== "published")
    throw new CrossFitSourceError("CrossFit day is not published yet", true)
  const markdown = wods.wodRaw.replaceAll("\r\n", "\n").trim()
  if (!markdown) throw new CrossFitSourceError("CrossFit workout is empty")
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(markdown),
  )
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
  return {
    date,
    url: crossFitSourceUrl(date),
    sourceId: wods.id,
    modified: wods.modified,
    markdown,
    hash,
  }
}

// @lat: [[crossfit-import#CrossFit Daily Import#Source Validation]]
export async function fetchCrossFitSource(
  date: string,
  fetcher: typeof fetch = fetch,
): Promise<CrossFitSource> {
  sourceDateSchema.parse(date)
  const response = await fetcher(
    `https://www.crossfit.com/workout/${date.replaceAll("-", "/")}`,
    {
      headers: { Accept: "application/json" },
      // Workers supports manual/follow; reject 3xx below without following it.
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    },
  )
  if (!response.ok) {
    const retryable =
      response.status === 404 ||
      response.status === 429 ||
      response.status >= 500
    const retryAfter = response.headers.get("retry-after")
    const retryAfterSeconds = retryAfter
      ? /^\d+$/.test(retryAfter)
        ? Number(retryAfter)
        : Math.max(0, (Date.parse(retryAfter) - Date.now()) / 1000)
      : 0
    await response.body?.cancel()
    throw new CrossFitSourceError(
      `CrossFit source returned HTTP ${response.status}`,
      retryable,
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : 0,
    )
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    await response.body?.cancel()
    throw new CrossFitSourceError("CrossFit source did not return JSON")
  }
  const reader = response.body?.getReader()
  if (!reader)
    throw new CrossFitSourceError("CrossFit source has no response body")
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ""
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      bytes += result.value.byteLength
      if (bytes > MAX_SOURCE_BYTES) {
        await reader.cancel()
        throw new CrossFitSourceError(
          "CrossFit response exceeds the size limit",
        )
      }
      text += decoder.decode(result.value, { stream: true })
    }
    text += decoder.decode()
  } finally {
    reader.releaseLock()
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new CrossFitSourceError("CrossFit returned malformed JSON")
  }
  return parseCrossFitResponse(value, date)
}
