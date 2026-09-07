import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), convert: vi.fn(), begin: vi.fn(), snapshot: vi.fn(), publish: vi.fn(), fail: vi.fn(),
}))
vi.mock("cloudflare:workers", () => ({ WorkflowEntrypoint: class { env = {} } }))
vi.mock("@sentry/cloudflare", () => ({ instrumentWorkflowWithSentry: (_: unknown, cls: unknown) => cls }))
vi.mock("@/lib/sentry/server", () => ({ getSentryOptions: vi.fn() }))
vi.mock("@/db", () => ({ getDb: () => ({}) }))
vi.mock("@/server/crossfit-converter", () => ({ convertCrossFitSource: mocks.convert }))
vi.mock("@/server/crossfit-import", () => ({ beginCrossFitImport: mocks.begin, snapshotCrossFitImport: mocks.snapshot, publishCrossFitImport: mocks.publish, failCrossFitImport: mocks.fail, getCrossFitImport: vi.fn() }))
vi.mock("@/lib/crossfit/source", async (actual) => ({ ...await actual<object>(), fetchCrossFitSource: mocks.fetch }))
import { CrossFitImportReviewError } from "@/lib/crossfit/errors"
import { CrossFitSourceError } from "@/lib/crossfit/source"
import { CrossFitDailyImportWorkflowBase } from "@/workflows/crossfit-daily-import-workflow"

function step() {
  return {
    do: vi.fn(async (_name: string, ...args: unknown[]) => (args.at(-1) as () => unknown)()),
    sleep: vi.fn(),
  }
}
const event = (mode: "publish" | "dry-run" = "publish") => ({ payload: { sourceDate: "2026-09-06", mode }, timestamp: new Date(), instanceId: "crossfit-2026-09-06" })
const snapshot = { date: "2026-09-06", markdown: "**Rest Day**", hash: "a", sourceId: "w20260906", modified: "now", url: "https://www.crossfit.com/260906" }
const normalized = { kind: "rest", components: [] }

beforeEach(() => {
  mocks.begin.mockResolvedValue({ id: "cf-import-2026-09-06", status: "pending" })
  mocks.fetch.mockResolvedValue(snapshot)
  mocks.convert.mockResolvedValue({ normalized, model: null, tokens: 0 })
  mocks.publish.mockResolvedValue({ id: "cf-import-2026-09-06", alreadyPublished: false })
})
describe("CrossFit durable orchestration", () => {
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Dry run isolation]]
  it("returns a reviewable preview without database writes", async () => {
    const workflow = new CrossFitDailyImportWorkflowBase({} as never, {} as never)
    expect(await workflow.run(event("dry-run") as never, step() as never)).toMatchObject({ status: "dry-run", normalized })
    for (const fn of [mocks.begin, mocks.snapshot, mocks.publish, mocks.fail]) expect(fn).not.toHaveBeenCalled()
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Completed workflow replay]]
  it("does not fetch or convert an already-published date", async () => {
    mocks.begin.mockResolvedValue({ id: "existing", status: "published" })
    const workflow = new CrossFitDailyImportWorkflowBase({} as never, {} as never)
    expect(await workflow.run(event() as never, step() as never)).toMatchObject({ status: "already-published" })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.convert).not.toHaveBeenCalled()
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Late publication retry]]
  it("sleeps after a late response then imports the same date", async () => {
    mocks.fetch.mockRejectedValueOnce(new CrossFitSourceError("not ready", true, 1200))
    const steps = step()
    const workflow = new CrossFitDailyImportWorkflowBase({} as never, {} as never)
    expect(await workflow.run(event() as never, steps as never)).toMatchObject({ status: "published" })
    expect(steps.sleep).toHaveBeenCalledWith("wait-for-source-0", 1200000)
    expect(mocks.fetch.mock.calls.every(([date]) => date === "2026-09-06")).toBe(true)
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Failed conversion remains private]]
  it("holds invalid conversion for review and propagates failure", async () => {
    mocks.convert.mockRejectedValue(new Error("unsupported score"))
    const workflow = new CrossFitDailyImportWorkflowBase({} as never, {} as never)
    await expect(workflow.run(event() as never, step() as never)).rejects.toThrow("unsupported score")
    expect(mocks.fail).toHaveBeenCalledWith({}, "2026-09-06", "needs_review", "unsupported score")
    expect(mocks.publish).not.toHaveBeenCalled()
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Permanent fetch failure]]
  it("fails a mismatched source without retrying or marking rest", async () => {
    mocks.fetch.mockRejectedValue(new CrossFitSourceError("wrong date"))
    const steps = step()
    const workflow = new CrossFitDailyImportWorkflowBase({} as never, {} as never)
    await expect(workflow.run(event() as never, steps as never)).rejects.toThrow("wrong date")
    expect(steps.sleep).not.toHaveBeenCalled()
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.fail).toHaveBeenCalledWith({}, "2026-09-06", "failed", "wrong date")
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Source revision review]]
  it("holds a source revision detected during publication for review", async () => {
    mocks.publish.mockRejectedValue(new CrossFitImportReviewError("Source changed during import; restart for review"))
    const workflow = new CrossFitDailyImportWorkflowBase({} as never, {} as never)
    await expect(workflow.run(event() as never, step() as never)).rejects.toThrow("Source changed")
    expect(mocks.fail).toHaveBeenCalledWith({}, "2026-09-06", "needs_review", "Source changed during import; restart for review")
  })

})

// @lat: [[crossfit-import#CrossFit Daily Import#Tests#Preview hash binding]]
it("holds changed source content before snapshot or publication", async () => {
  const workflow = new CrossFitDailyImportWorkflowBase({} as never, {} as never)
  const e = event()
  await expect(
    workflow.run(
      {
        ...e,
        payload: { ...e.payload, expectedSourceHash: "b".repeat(64) },
      } as never,
      step() as never,
    ),
  ).rejects.toThrow("Source content changed since preview")
  expect(mocks.snapshot).not.toHaveBeenCalled()
  expect(mocks.publish).not.toHaveBeenCalled()
  expect(mocks.fail).toHaveBeenCalledWith(
    {},
    "2026-09-06",
    "needs_review",
    expect.any(String),
  )
})
