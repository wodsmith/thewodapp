import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentType, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ data: vi.fn(), invalidate: vi.fn(), save: vi.fn() }))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options, useLoaderData: mocks.data, useParams: () => ({ groupId: "series", eventId: "template" }), useSearch: () => ({}) }),
  Link: ({ children }: { children: ReactNode }) => <a href="/series">{children}</a>,
  useRouter: () => ({ invalidate: mocks.invalidate }),
}))
vi.mock("@/server-fns/series-event-template-fns", () => ({ getSeriesTemplateEventByIdFn: vi.fn(), getSeriesTemplateEventsFn: vi.fn(), updateSeriesTemplateEventFn: mocks.save }))
vi.mock("@/server-fns/competition-fns", () => ({ getCompetitionGroupByIdFn: vi.fn() }))
vi.mock("@/server-fns/event-resources-fns", () => ({ getEventResourcesFn: vi.fn() }))
vi.mock("@/server-fns/judging-sheet-fns", () => ({ getEventJudgingSheetsFn: vi.fn() }))
vi.mock("@/server-fns/movement-fns", () => ({ getAllMovementsFn: vi.fn() }))
vi.mock("@/server-fns/competition-workouts-fns", () => ({ getWorkoutDivisionDescriptionsFn: vi.fn(), updateWorkoutDivisionDescriptionsFn: vi.fn() }))
vi.mock("@/server-fns/series-division-mapping-fns", () => ({ getSeriesTemplateDivisionsFn: vi.fn() }))
vi.mock("@/components/events/event-resources-card", () => ({ EventResourcesCard: () => null }))
vi.mock("@/components/organizer/event-judging-sheets", () => ({ EventJudgingSheets: () => null }))
vi.mock("@/components/movements-list", () => ({ MovementsList: () => null }))
import { Route } from "@/routes/compete/organizer/series/$groupId/events/$eventId"
const Page = Route.options.component as ComponentType
const event = { id: "template", workoutId: "workout", name: "Intervals", order: 1, trackOrder: 1, pointsMultiplier: 100, notes: null, workout: { name: "Intervals", description: "Row 500m three times", scheme: "time-with-cap", scoreType: "first", roundsToScore: 3, timeCap: 300, tiebreakScheme: "reps" } }
function data(child = false) {
 return { event, movementIds: ["row"], movements: [], organizingTeamId: "gym", divisions: [], divisionDescriptions: [], resources: [], judgingSheets: [], childEvents: child ? [{ ...event, id: "child", workoutId: "child-workout", parentEventId: "template" }] : [], childDivisionDescriptions: {}, childMovementIds: { child: ["row"] } }
}
beforeEach(() => { mocks.save.mockResolvedValue({}); mocks.invalidate.mockResolvedValue(undefined) })
afterEach(cleanup)
describe("series event detail metadata", () => {
 // @lat: [[athlete-workout-review#Series Detail Propagation#Single-event edits retain authored scoring]]
 it("hydrates existing rounds and tiebreak, preserves them on a description edit, and saves changed rounds", async () => {
  mocks.data.mockReturnValue(data())
  render(<Page />)
  expect(screen.getByLabelText("Rounds to Score")).toHaveValue(3)
  expect(screen.getByRole("combobox", { name: /Tiebreak/ })).toHaveTextContent("Reps")
  expect(screen.getByRole("combobox", { name: "Score Type" })).toHaveTextContent("First recorded score")
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Updated rowing instructions" } })
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Save changes" })[0]).toBeEnabled())
  fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]!)
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ data: expect.objectContaining({ workout: expect.objectContaining({ description: "Updated rowing instructions", roundsToScore: 3, tiebreakScheme: "reps", scoreType: "first" }), movementIds: ["row"] }) }))
  fireEvent.change(screen.getByLabelText("Rounds to Score"), { target: { value: "4" } })
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Save changes" })[0]).toBeEnabled())
  fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0]!)
  await waitFor(() => expect(mocks.save).toHaveBeenLastCalledWith({ data: expect.objectContaining({ workout: expect.objectContaining({ roundsToScore: 4, tiebreakScheme: "reps" }) }) }))
 })
 // @lat: [[athlete-workout-review#Series Detail Propagation#Sub-event edits retain authored scoring]]
 it("hydrates and persists sub-event rounds, tiebreak and movements under its own identity", async () => {
  mocks.data.mockReturnValue(data(true))
  render(<Page />)
  expect(screen.getByLabelText("Rounds to Score")).toHaveValue(3)
  expect(screen.getByRole("combobox", { name: /Tiebreak/ })).toHaveTextContent("Reps")
  fireEvent.change(screen.getByLabelText("Rounds to Score"), { target: { value: "2" } })
  fireEvent.click(screen.getByRole("combobox", { name: /Tiebreak/ }))
  fireEvent.click(await screen.findByRole("option", { name: "Time" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Save sub-event" })).toBeEnabled())
  fireEvent.click(screen.getByRole("button", { name: "Save sub-event" }))
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ data: expect.objectContaining({ trackWorkoutId: "child", workout: expect.objectContaining({ roundsToScore: 2, tiebreakScheme: "time" }), movementIds: ["row"] }) }))
 })
})
