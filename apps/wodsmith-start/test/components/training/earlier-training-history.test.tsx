import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EarlierTrainingHistory } from "@/components/training/earlier-training-history"
import { getLogsByUserFn } from "@/server-fns/log-fns"

vi.mock("@/server-fns/log-fns", () => ({ getLogsByUserFn: vi.fn() }))
afterEach(cleanup)

type LogPage = Awaited<ReturnType<typeof getLogsByUserFn>>
function page(start: number, count: number): LogPage {
  return { logs: Array.from({ length: count }, (_, index) => ({
    id: `score-${start + index}`, userId: "athlete", teamId: "gym", date: new Date("2026-09-01T00:00:00Z"), workoutId: `workout-${start + index}`, notes: `Private note ${start + index}`, scalingLevelId: null, asRx: true, scalingLevelLabel: undefined, scalingLevelPosition: undefined, scoreValue: 300000, secondaryValue: null, scheme: "time", status: "scored", createdAt: new Date(), updatedAt: new Date(), workoutName: `Workout ${start + index}`, personalLibraryItem: null, personalDisplayScore: null, displayScore: "5:00",
  })) }
}

describe("earlier training history", () => {
  // @lat: [[training#Library Result Tests#Earlier history loads bounded pages]]
  it("requests twenty results at a time and appends the next page", async () => {
    vi.mocked(getLogsByUserFn).mockResolvedValueOnce(page(1, 20)).mockResolvedValueOnce(page(21, 2))
    render(<EarlierTrainingHistory userId="athlete" teamId="gym" />)
    await screen.findByRole("heading", { name: "Workout 20" })
    expect(getLogsByUserFn).toHaveBeenLastCalledWith({ data: { userId: "athlete", teamId: "gym", personalOnly: true, limit: 20, offset: 0 } })
    expect(screen.getAllByRole("link", { name: "Edit result" })).toHaveLength(20)
    fireEvent.click(screen.getByRole("button", { name: "Show more results" }))
    await screen.findByRole("heading", { name: "Workout 22" })
    expect(getLogsByUserFn).toHaveBeenLastCalledWith({ data: { userId: "athlete", teamId: "gym", personalOnly: true, limit: 20, offset: 20 } })
    expect(screen.getAllByRole("link", { name: "Edit result" })).toHaveLength(22)
    expect(screen.getByText("Private note 1")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Show more results" })).not.toBeInTheDocument()
  })

  // @lat: [[training#Library Result Tests#History pagination failures retain earlier results]]
  it("keeps earlier rows after a failed page and retries the same offset", async () => {
    vi.mocked(getLogsByUserFn).mockResolvedValueOnce(page(1, 20)).mockRejectedValueOnce(new Error("Connection interrupted")).mockResolvedValueOnce(page(21, 1))
    render(<EarlierTrainingHistory userId="athlete" teamId="gym" />)
    await screen.findByRole("heading", { name: "Workout 20" })
    fireEvent.click(screen.getByRole("button", { name: "Show more results" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted")
    expect(screen.getAllByRole("link", { name: "Edit result" })).toHaveLength(20)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await screen.findByRole("heading", { name: "Workout 21" })
    expect(getLogsByUserFn).toHaveBeenLastCalledWith({ data: { userId: "athlete", teamId: "gym", personalOnly: true, limit: 20, offset: 20 } })
    expect(screen.getAllByRole("link", { name: "Edit result" })).toHaveLength(21)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  // @lat: [[training#Library Result Tests#History gym changes discard stale pages]]
  it("starts the new gym at zero and ignores a late page from the previous gym", async () => {
    let finishOldPage: (value: LogPage) => void = () => {}
    vi.mocked(getLogsByUserFn).mockResolvedValueOnce(page(1, 20)).mockImplementationOnce(() => new Promise((resolve) => { finishOldPage = resolve })).mockResolvedValueOnce(page(100, 1))
    const { rerender } = render(<EarlierTrainingHistory userId="athlete" teamId="gym" />)
    await screen.findByRole("heading", { name: "Workout 20" })
    fireEvent.click(screen.getByRole("button", { name: "Show more results" }))
    await waitFor(() => expect(getLogsByUserFn).toHaveBeenCalledTimes(2))
    rerender(<EarlierTrainingHistory userId="athlete" teamId="other-gym" />)
    await screen.findByRole("heading", { name: "Workout 100" })
    expect(getLogsByUserFn).toHaveBeenLastCalledWith({ data: { userId: "athlete", teamId: "other-gym", personalOnly: true, limit: 20, offset: 0 } })
    await act(async () => { finishOldPage(page(21, 20)) })
    expect(screen.queryByText("Private note 1")).not.toBeInTheDocument()
    expect(screen.queryByText("Private note 21")).not.toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Edit result" })).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Edit result" })).toHaveAttribute("href", expect.stringContaining("other-gym"))
  })
})
