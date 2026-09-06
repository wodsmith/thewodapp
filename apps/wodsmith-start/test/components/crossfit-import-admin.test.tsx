import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, it, expect, vi } from "vitest"
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
  await screen.findByText("For time · 3 minute cap")
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
  await waitFor(() => expect(date).not.toBeDisabled())
  fireEvent.change(date, { target: { value: "2026-09-05" } })
  expect(
    screen.queryByRole("button", { name: "Publish date" }),
  ).not.toBeInTheDocument()
})
