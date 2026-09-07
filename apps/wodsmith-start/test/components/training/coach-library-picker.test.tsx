import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
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
    expect(add.mock.calls[0][0]).toMatchObject({kind:"workout", title:"Fran", prescription:"21-15-9", workout: {scheme:"time", scoreType:"min"}})
    expect(add.mock.calls[0][0].id).not.toBe("fran")
  })
  it("preserves multi-round caps, tiebreaks, and movements in the draft snapshot", async () => {
    api.detail.mockResolvedValue({...workout, scheme:"time-with-cap", roundsToScore:3, scoreType:"sum", timeCap:180, tiebreakScheme:"reps", movementIds:["pull-up"], scalingGroupId:"gym-scaling"})
    const add = vi.fn()
    render(<CoachLibraryPicker teamId="gym" disabled={false} onAdd={add} />)
    fireEvent.click(screen.getByRole("button", { name: "Add from workout library" }))
    fireEvent.click(screen.getByRole("button", { name: "Search library" }))
    fireEvent.click(await screen.findByRole("button", { name: "Add Fran to draft" }))
    await waitFor(() => expect(add).toHaveBeenCalledOnce())
    expect(add.mock.calls[0][0]).toMatchObject({kind:"workout", workout:{scheme:"time-with-cap",roundsToScore:3,scoreType:"sum",timeCapSeconds:180,tiebreakScheme:"reps",movementIds:["pull-up"],scalingGroupId:"gym-scaling"}})
  })
})

// @lat: [[training#Workout Library#Library request ordering]]
it("keeps the latest search when an earlier request finishes last", async () => {
  let finishFirst!: (value: typeof workout[]) => void
  let finishSecond!: (value: typeof workout[]) => void
  api.list.mockReturnValueOnce(new Promise((resolve) => { finishFirst = resolve }))
    .mockReturnValueOnce(new Promise((resolve) => { finishSecond = resolve }))
  render(<CoachLibraryPicker teamId="gym" disabled={false} onAdd={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", {name:"Add from workout library"}))
  const input = screen.getByLabelText("Find a library workout")
  fireEvent.change(input, {target:{value:"Fran"}})
  fireEvent.keyDown(input, {key:"Enter"})
  fireEvent.change(input, {target:{value:"Grace"}})
  fireEvent.keyDown(input, {key:"Enter"})
  await act(async () => finishSecond([{...workout,id:"grace",name:"Grace"}]))
  expect(screen.getByRole("button", {name:"Add Grace to draft"})).toBeEnabled()
  await act(async () => finishFirst([workout]))
  expect(screen.queryByRole("button", {name:"Add Fran to draft"})).not.toBeInTheDocument()
  expect(screen.getByRole("button", {name:"Add Grace to draft"})).toBeEnabled()
})

// @lat: [[training#Workout Library#Library requests retain gym context]]
it("does not add a workout from a detail request after the gym changes", async () => {
  let finishDetail!: (value: typeof workout) => void
  api.detail.mockReturnValueOnce(new Promise((resolve) => { finishDetail = resolve }))
  const add = vi.fn()
  const view = render(<CoachLibraryPicker teamId="gym-a" disabled={false} onAdd={add} />)
  fireEvent.click(screen.getByRole("button", {name:"Add from workout library"}))
  fireEvent.click(screen.getByRole("button", {name:"Search library"}))
  fireEvent.click(await screen.findByRole("button", {name:"Add Fran to draft"}))
  view.rerender(<CoachLibraryPicker teamId="gym-b" disabled={false} onAdd={add} />)
  await act(async () => finishDetail(workout))
  expect(add).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", {name:"Add Fran to draft"})).not.toBeInTheDocument()
  expect(screen.getByRole("button", {name:"Search library"})).toBeEnabled()
})
