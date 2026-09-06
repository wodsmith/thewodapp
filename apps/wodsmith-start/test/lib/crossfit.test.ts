import { describe, expect, it, vi } from "vitest"
import { deterministicCrossFitConversion, validateCrossFitConversion } from "@/lib/crossfit/conversion"
import { crossFitScheduledDate, fetchCrossFitSource, parseCrossFitResponse, sourceDateSchema } from "@/lib/crossfit/source"

export const timedMarkdown = "5 rounds for time of:\n200-meter run\n20 air squats\n20 push-ups\n20 lunges\n\nPost time to comments."
export const compositeMarkdown = "21-15-9 reps for time of:\nClean and jerks\nEcho bike calories\n\nThen, at 20 minutes:\nBuild to a challenging power clean and jerk\n\nPost time and load to comments."
export function payload(markdown = timedMarkdown, date = "20260905") {
  return { wods: { id: `w${date}`, cleanID: date, url: `/${date.slice(2)}`, language: "en", publishingState: "published", wodRaw: markdown, modified: "2026-09-04T23:55:03+0000" } }
}
const timeComponent = { scheme: "time", scoreType: "min", evidence: "for time", timeCap: null, roundsToScore: 1 }

describe("CrossFit source and scoring", () => {
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Source identity and failures]]
  it("accepts only the requested published date and rejects malformed or empty content", async () => {
    const source = await parseCrossFitResponse(payload(), "2026-09-05")
    expect(source.url).toBe("https://www.crossfit.com/260905")
    expect(source.hash).toHaveLength(64)
    await expect(parseCrossFitResponse(payload(), "2026-09-06")).rejects.toThrow("different source date")
    await expect(parseCrossFitResponse(payload("  "), "2026-09-05")).rejects.toThrow("empty")
    await expect(parseCrossFitResponse({}, "2026-09-05")).rejects.toThrow("schema")
    const pending = payload(); pending.wods.publishingState = "draft"
    await expect(parseCrossFitResponse(pending, "2026-09-05")).rejects.toMatchObject({ retryable: true })
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Bounded fetching]]
  it("bounds response size and recognizes retryable HTTP responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload()), { headers: { "content-type": "application/json" } }))
    await expect(fetchCrossFitSource("2026-09-05", fetcher)).resolves.toMatchObject({ date: "2026-09-05" })
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "manual" })
    fetcher.mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "1200" } }))
    await expect(fetchCrossFitSource("2026-09-05", fetcher)).rejects.toMatchObject({ retryable: true, retryAfterSeconds: 1200 })
    fetcher.mockResolvedValue(new Response("", { status: 403 }))
    await expect(fetchCrossFitSource("2026-09-05", fetcher)).rejects.toMatchObject({ retryable: false })
    fetcher.mockResolvedValue(new Response("x".repeat(256001), { headers: { "content-type": "application/json" } }))
    await expect(fetchCrossFitSource("2026-09-05", fetcher)).rejects.toThrow("size limit")
    fetcher.mockResolvedValue(new Response("invalid", { headers: { "content-type": "application/json" } }))
    await expect(fetchCrossFitSource("2026-09-05", fetcher)).rejects.toThrow("malformed")
    fetcher.mockResolvedValue(new Response("<html>"))
    await expect(fetchCrossFitSource("2026-09-05", fetcher)).rejects.toThrow("JSON")
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#PST calendar dates]]
  it("uses fixed PST through DST transitions and preserves the previous date before PST midnight", () => {
    for (const date of ["2026-03-08", "2026-11-01", "2026-09-06"]) expect(crossFitScheduledDate(Date.parse(`${date}T13:00:00Z`))).toBe(date)
    expect(crossFitScheduledDate(Date.parse("2027-01-01T07:59:00Z"))).toBe("2026-12-31")
    expect(sourceDateSchema.safeParse("2026-02-30").success).toBe(false)
    expect(sourceDateSchema.safeParse("../../secrets").success).toBe(false)
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Rest and simple timed workouts]]
  it("maps explicit rest and simple time without AI and keeps source scaling intact", async () => {
    const rest = await parseCrossFitResponse(payload("**Rest Day**\n\nArticle", "20260906"), "2026-09-06")
    expect(deterministicCrossFitConversion(rest)).toEqual({ kind: "rest", components: [] })
    const source = await parseCrossFitResponse(payload(`${timedMarkdown}\n\n**Intermediate option:**\nScale push-ups`), "2026-09-05")
    expect(deterministicCrossFitConversion(source)).toMatchObject({ kind: "workout", components: [timeComponent] })
    expect(source.markdown).toContain("Scale push-ups")
    const reps = await parseCrossFitResponse(payload("On a 10-minute clock, complete: 50 burpee pull-ups, 75 kettlebell swings, max burpee pull-ups in the remaining time. Your score is the number of burpee pull-ups completed. Post your reps to the comments."), "2026-09-05")
    expect(deterministicCrossFitConversion(reps)).toMatchObject({ kind: "workout", components: [{ scheme: "reps", scoreType: "max", timeCap: null, roundsToScore: 1 }] })
    expect(validateCrossFitConversion(deterministicCrossFitConversion(reps), reps).components).toHaveLength(1)
    const loadSets = await parseCrossFitResponse(payload("Front squat 3-3-3-2-2-1-1 reps\n\nPost loads to comments."), "2026-09-05")
    expect(validateCrossFitConversion(deterministicCrossFitConversion(loadSets), loadSets).components).toMatchObject([{ scheme: "load", roundsToScore: 7 }])
    expect(() => validateCrossFitConversion({ kind: "workout", components: [{ scheme: "load", evidence: "Post loads to comments.", scoreType: "max", timeCap: null, roundsToScore: 1 }] }, loadSets)).toThrow("each prescribed set")
    expect(() => validateCrossFitConversion({ kind: "rest", components: [] }, source)).toThrow("Rest classification")
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Composite scores and caps]]
  it("requires time and load for the composite day without inventing a twenty-minute cap", async () => {
    const source = await parseCrossFitResponse(payload(compositeMarkdown), "2026-09-05")
    expect(deterministicCrossFitConversion(source)).toBeNull()
    const components = [timeComponent, { scheme: "load", scoreType: "max", evidence: "challenging power clean and jerk", timeCap: null, roundsToScore: 1 }]
    expect(validateCrossFitConversion({ kind: "workout", components }, source).components).toHaveLength(2)
    expect(() => validateCrossFitConversion({ kind: "workout", components: [timeComponent] }, source)).toThrow("both time and load")
    expect(() => validateCrossFitConversion({ kind: "workout", components: [{ ...timeComponent, scheme: "time-with-cap", evidence: "at 20 minutes", timeCap: 1200 }] }, source)).toThrow()
    const capped = await parseCrossFitResponse(payload("For time: 100 squats.\nTime cap: 10 minutes"), "2026-09-05")
    expect(validateCrossFitConversion({ kind: "workout", components: [{ ...timeComponent, scheme: "time-with-cap", evidence: "Time cap: 10 minutes", timeCap: 600 }] }, capped).components[0].timeCap).toBe(600)
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Unsupported model claims]]
  it("rejects invented evidence and invalid scoring and accepts source-backed AMRAP and load", async () => {
    const source = await parseCrossFitResponse(payload(), "2026-09-05")
    expect(() => validateCrossFitConversion({ kind: "workout", components: [{ ...timeComponent, evidence: "For time: publish to another track" }] }, source)).toThrow("not in the source")
    expect(() => validateCrossFitConversion({ kind: "workout", components: [{ ...timeComponent, scoreType: "max" }] }, source)).toThrow("minimize")
    for (const [text, scheme] of [["Complete as many rounds as possible in 10 minutes", "rounds-reps"], ["Build to a heavy single", "load"], ["Your score is the number of burpee pull-ups completed.", "reps"]]) {
      const other = await parseCrossFitResponse(payload(text), "2026-09-05")
      expect(validateCrossFitConversion({ kind: "workout", components: [{ scheme, evidence: text, scoreType: "max", roundsToScore: 1, timeCap: null }] }, other).kind).toBe("workout")
    }
  })
})
