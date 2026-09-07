import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, it, expect, vi } from "vitest"
import {
  runCrossFitImportFn as runPreviewFixture,
  getCrossFitRunStatusFn as previewFixtureStatus,
  providerDays,
} from "../preview/training/track-fixtures"
import { CrossFitImportAdmin } from "@/components/crossfit-import-admin"
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  run: vi.fn(),
  status: vi.fn(),
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server-fns/crossfit-import-fns", () => ({
  getCrossFitImportsFn: mocks.load,
  runCrossFitImportFn: mocks.run,
  getCrossFitRunStatusFn: mocks.status,
}))
beforeEach(() => {
  mocks.load.mockResolvedValue([])
  mocks.run.mockResolvedValue({ id: "crossfit-preview-test" })
  mocks.status.mockResolvedValue({
    status: "complete",
    error: null,
    output: JSON.stringify({
      status: "dry-run",
      date: "2026-09-04",
      source: { hash: "a".repeat(64), markdown: "For time" },
      normalized: {
        kind: "workout",
        components: [
          {
            scheme: "time-with-cap",
            scoreType: "min",
            evidence: "For time",
            timeCap: 180,
            roundsToScore: 1,
          },
          {
            scheme: "load",
            scoreType: "max",
            evidence: "Lift",
            timeCap: null,
            roundsToScore: 3,
          },
        ],
      },
    }),
  })
})
// @lat: [[crossfit-import#CrossFit Daily Import#Tests#Admin preview date consent]]
it("requires a same-date completed preview and binds publish to its hash", async () => {
  render(<CrossFitImportAdmin />)
  const date = screen.getByLabelText("CrossFit workout date")
  fireEvent.change(date, { target: { value: "2026-09-04" } })
  expect(
    screen.queryByRole("button", { name: "Publish date" }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Preview import" }))
  await screen.findByText("Import started")
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  await screen.findByText("For time · 3:00 cap")
  expect(screen.getByText("Load · 3 scores · max")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Publish date" }))
  await waitFor(() =>
    expect(mocks.run).toHaveBeenCalledWith({
      data: {
        sourceDate: "2026-09-04",
        mode: "publish",
        expectedSourceHash: "a".repeat(64),
      },
    }),
  )
  expect(date).toBeDisabled()
  expect(screen.getByRole("button", { name: "Publish date" })).toBeDisabled()
  mocks.status.mockRejectedValueOnce(
    new Error("Status temporarily unavailable"),
  )
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  await screen.findByText("Status temporarily unavailable")
  expect(screen.getByRole("button", { name: "Publish date" })).toBeDisabled()
  expect(mocks.run).toHaveBeenCalledTimes(2)
  mocks.status.mockResolvedValueOnce({
    status: "errored",
    error: "Publish failed",
    output: "null",
  })
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  await screen.findByText("Publish failed")
  await waitFor(() => expect(date).not.toBeDisabled())
  expect(screen.getByRole("button", { name: "Publish date" })).toBeEnabled()
  await act(async () => {
    fireEvent.change(date, { target: { value: "2026-09-05" } })
  })
  expect(
    screen.queryByRole("button", { name: "Publish date" }),
  ).not.toBeInTheDocument()
})

// @lat: [[crossfit-import#CrossFit Daily Import#Tests#Preview fixtures retain date identity]]
it("uses the selected date for fixture source text and rest classification", async () => {
  for (const source of providerDays) {
    await runPreviewFixture({
      data: { sourceDate: source.date, mode: "dry-run" },
    })
    const result = await previewFixtureStatus()
    expect(JSON.parse(result.output)).toMatchObject({
      date: source.date,
      source: { markdown: source.markdown },
      normalized: { kind: source.kind },
    })
  }
  await runPreviewFixture({
    data: { sourceDate: "2026-09-05", mode: "dry-run" },
  })
  expect(await previewFixtureStatus()).toMatchObject({
    status: "errored",
    output: "null",
  })
})

// @lat: [[crossfit-import#CrossFit Daily Import#Tests#Selected admin date outside history]]
it("reuses loader history and recognizes a published date outside its latest sixty entries", async () => {
  const old = "2025-01-01"
  mocks.load.mockImplementation(async (input?: { data?: { date?: string } }) =>
    input?.data?.date === old
      ? [
          {
            id: "old-import",
            sourceDate: old,
            status: "published",
            kind: "workout",
            error: null,
            sourceMarkdown: "Old source",
            publishedAt: new Date("2025-01-01T13:00:00Z"),
          },
        ]
      : [],
  )
  render(<CrossFitImportAdmin initialRows={[]} />)
  await waitFor(() => expect(mocks.load).toHaveBeenCalled())
  expect(mocks.load.mock.calls.every(([input]) => input?.data?.date)).toBe(true)
  fireEvent.change(screen.getByLabelText("CrossFit workout date"), {
    target: { value: old },
  })
  await screen.findByText("Already published")
  expect(
    screen.getByRole("link", { name: "Open published day" }),
  ).toHaveAttribute("href", `/programming/ptrk_crossfit_dotcom?date=${old}`)
  expect(
    screen.queryByRole("button", { name: "Publish date" }),
  ).not.toBeInTheDocument()
})
it("renders selected workout and rest fixture previews through the actual admin component", async () => {
  mocks.run.mockImplementation(runPreviewFixture)
  mocks.status.mockImplementation(previewFixtureStatus)
  render(<CrossFitImportAdmin initialRows={[]} />)
  for (const source of [...providerDays].reverse()) {
    fireEvent.change(screen.getByLabelText("CrossFit workout date"), {
      target: { value: source.date },
    })
    fireEvent.click(screen.getByRole("button", { name: "Preview import" }))
    await screen.findByText("Import started")
    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
    await screen.findByText("Import complete")
    if (source.kind === "rest") {
      expect(
        screen.getByRole("heading", { name: "Rest day" }),
      ).toBeInTheDocument()
      expect(screen.queryByText("For time · 3:00 cap")).not.toBeInTheDocument()
    } else {
      expect(screen.getByText("For time · 3:00 cap")).toBeInTheDocument()
      expect(
        screen.getByText(/Thrusters Pull-ups/, { exact: false }),
      ).toBeInTheDocument()
    }
    await waitFor(() =>
      expect(screen.getByLabelText("CrossFit workout date")).toBeEnabled(),
    )
  }
})
it("holds publishing while selected-date status is pending or failed and recovers on refresh", async () => {
  let rejectLookup!: (error: Error) => void
  mocks.load.mockImplementation((input?: { data?: { date?: string } }) =>
    input?.data?.date === "2026-09-04"
      ? new Promise((_resolve, reject) => {
          rejectLookup = reject
        })
      : Promise.resolve([]),
  )
  render(<CrossFitImportAdmin initialRows={[]} />)
  fireEvent.change(screen.getByLabelText("CrossFit workout date"), {
    target: { value: "2026-09-04" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Preview import" }))
  await screen.findByText("Import started")
  // Status refresh is itself authoritative: its date read must finish before consent enables.
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  await screen.findByText("For time · 3:00 cap")
  expect(screen.getByRole("button", { name: "Publish date" })).toBeDisabled()
  rejectLookup(new Error("Selected date unavailable"))
  await screen.findByText("Selected date unavailable")
  expect(screen.getByRole("button", { name: "Publish date" })).toBeDisabled()
  mocks.load.mockResolvedValue([])
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Publish date" })).toBeEnabled(),
  )
})

it("keeps a completed publication locked through a failed history read and then shows its older published day", async () => {
  const old = "2025-01-01"
  const preview = await mocks.status()
  const output = JSON.parse(preview.output)
  mocks.status.mockResolvedValue({
    ...preview,
    output: JSON.stringify({ ...output, date: old }),
  })
  render(<CrossFitImportAdmin initialRows={[]} />)
  fireEvent.change(screen.getByLabelText("CrossFit workout date"), {
    target: { value: old },
  })
  fireEvent.click(screen.getByRole("button", { name: "Preview import" }))
  await screen.findByText("Import started")
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Publish date" })).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole("button", { name: "Publish date" }))
  await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2))
  mocks.status.mockResolvedValue({
    status: "complete",
    error: null,
    output: JSON.stringify({ status: "already-published" }),
  })
  mocks.load.mockRejectedValue(new Error("History unavailable"))
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  await screen.findByText("History unavailable")
  expect(screen.getByRole("button", { name: "Publish date" })).toBeDisabled()
  mocks.load.mockImplementation(async (input?: { data?: { date?: string } }) =>
    input?.data?.date === old
      ? [
          {
            id: "older",
            sourceDate: old,
            status: "published",
            kind: "workout",
            error: null,
            publishedAt: null,
          },
        ]
      : [],
  )
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  await screen.findByText("Already published")
  expect(
    screen.queryByRole("button", { name: "Publish date" }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole("link", { name: "Open published day" }),
  ).toHaveAttribute("href", `/programming/ptrk_crossfit_dotcom?date=${old}`)
})

it("releases a terminal needs-review run after a successful date read and requires another preview", async () => {
  render(<CrossFitImportAdmin initialRows={[]} />)
  fireEvent.change(screen.getByLabelText("CrossFit workout date"), {
    target: { value: "2026-09-04" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Preview import" }))
  await screen.findByText("Import started")
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Publish date" })).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole("button", { name: "Publish date" }))
  await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2))
  mocks.status.mockResolvedValue({
    status: "complete",
    error: null,
    output: JSON.stringify({ status: "needs_review" }),
  })
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  await screen.findByText("Complete a preview for this date before publishing.")
  expect(screen.getByRole("button", { name: "Preview import" })).toBeEnabled()
  expect(screen.getByLabelText("CrossFit workout date")).toBeEnabled()
  expect(
    screen.queryByRole("button", { name: "Publish date" }),
  ).not.toBeInTheDocument()
})
