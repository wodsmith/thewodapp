import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))
vi.mock("@/server-fns/training-personal-fns", () => ({ listTrainingLibraryWorkoutsFn: api.list, getTrainingLibraryWorkoutFn: api.detail }))
import { CoachLibraryPicker } from "@/components/training/coach-library-picker"
const workout = { id: "fran", name: "Fran", description: "21-15-9", scheme: "time", scoreType: "min", roundsToScore: 1, timeCap: null, repsPerRound: null, tiebreakScheme: null }
beforeEach(() => { vi.clearAllMocks(); api.list.mockResolvedValue([workout]); api.detail.mockResolvedValue(workout) })
describe("coach library reuse", () => {
  it("searches the selected gym and adds an independent section", async () => {
    const add = vi.fn()
    render(<CoachLibraryPicker teamId="gym-b" disabled={false} onAdd={add} />)
    fireEvent.click(screen.getByRole("button", { name: "Add from workout library" }))
    fireEvent.change(screen.getByLabelText("Find a library workout"), { target: { value: "Fran" } })
    fireEvent.click(screen.getByRole("button", { name: "Search library" }))
    fireEvent.click(await screen.findByRole("button", { name: "Add Fran to draft" }))
    await waitFor(() => expect(add).toHaveBeenCalledOnce())
    expect(api.list).toHaveBeenCalledWith({ data: { teamId: "gym-b", search: "Fran" } })
    expect(add.mock.calls[0][0]).toMatchObject({kind:"time", title:"Fran", prescription:"21-15-9"})
    expect(add.mock.calls[0][0].id).not.toBe("fran")
  })
  it("keeps the picker open and explains unsupported scoring without adding", async () => {
    api.detail.mockResolvedValue({...workout, roundsToScore:3})
    const add = vi.fn()
    render(<CoachLibraryPicker teamId="gym" disabled={false} onAdd={add} />)
    fireEvent.click(screen.getByRole("button", { name: "Add from workout library" }))
    fireEvent.click(screen.getByRole("button", { name: "Search library" }))
    fireEvent.click(await screen.findByRole("button", { name: "Add Fran to draft" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("cannot preserve")
    expect(add).not.toHaveBeenCalled()
    expect(screen.getByRole("region",{name:"Workout library picker"})).toBeInTheDocument()
  })
})
