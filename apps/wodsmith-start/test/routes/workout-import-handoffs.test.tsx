import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentType, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({
  navigate: vi.fn().mockResolvedValue(undefined),
  invalidate: vi.fn(),
  submitDirectLog: vi.fn(),
  submitPersonalLog: vi.fn(),
  getWorkouts: vi.fn(),
  getDirectEntry: vi.fn(),
  getContext: vi.fn(),
  getPersonalDay: vi.fn(),
  savePersonalSession: vi.fn(),
  importFailed: vi.fn(),
  search: {} as Record<string, unknown>,
  data: {} as Record<string, unknown>,
  panelProps: {} as Record<string, unknown>,
}))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options, useLoaderData: () => mock.data, useSearch: () => ({ workoutId: "original", ...mock.search }) }),
  redirect: (options: unknown) => options,
  useNavigate: () => mock.navigate, useRouter: () => ({ invalidate: mock.invalidate }),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))
vi.mock("@/server-fns/training-personal-fns", () => ({
  getPersonalTrainingDayFn: mock.getPersonalDay,
  getDirectLibraryEntryFn: mock.getDirectEntry,
  saveDirectLibraryResultFn: mock.submitDirectLog,
  getPersonalLibraryScalingLevelsFn: vi.fn(),
  savePersonalLibraryResultFn: mock.submitPersonalLog,
  savePersonalTrainingSessionFn: mock.savePersonalSession,
}))
vi.mock("@/server-fns/training-fns", () => ({getTrainingContextFn: mock.getContext}))
vi.mock("@/server-fns/workout-fns", () => ({ getWorkoutByIdFn: vi.fn(), getWorkoutsFn: mock.getWorkouts }))
vi.mock("@/server-fns/programming-fns", () => ({ getProgrammingTrackByIdFn: vi.fn(), getTrackWorkoutsFn: vi.fn(), addWorkoutToTrackFn: vi.fn() }))
vi.mock("@/components/track-header", () => ({ TrackHeader: () => null }))
vi.mock("@/components/track-workout-list", () => ({ TrackWorkoutList: () => null }))
vi.mock("@/components/workout-import/workout-import-entry", () => ({
  WorkoutImportEntry: ({ onSaved }: { onSaved: (result: { workoutId: string }) => Promise<void> }) => <button type="button" onClick={() => onSaved({ workoutId: "imported" }).catch(mock.importFailed)}>Finish entitled import</button>,
  WorkoutImportAccessButton: ({ onClick }: { onClick: () => void }) => <button type="button" onClick={onClick}>Import workout</button>,
}))
vi.mock("@/components/workout-import/workout-import-panel", () => ({
  WorkoutImportPanel: (props: Record<string, unknown>) => { mock.panelProps = props; return <button type="button" onClick={() => (props.onSaved as () => void)()}>Finish track import</button> },
}))
import { Route as LogRoute } from "@/routes/_protected/log/new/index"
import { Route as SettingsRoute } from "@/routes/_protected/settings/programming/$trackId/index"
import { Route as AdminRoute } from "@/routes/_protected/admin/teams/programming/$trackId/index"

beforeEach(() => {
  mock.search = {}
  mock.submitDirectLog.mockResolvedValue({scoreId: "direct-score"})
  mock.submitPersonalLog.mockResolvedValue({scoreId: "personal-score"})
  mock.getContext.mockResolvedValue({teams:[{id:"team-personal", name:"My training",timezone:"UTC",isPersonal:true}]})
  mock.getDirectEntry.mockResolvedValue({workout:{id:"original", name:"Original workout", scheme:"time"},levels:[]})
  mock.navigate.mockResolvedValue(undefined)
  mock.getWorkouts.mockResolvedValue({ workouts: [] })
  mock.data = { workouts: [], selectedWorkout: { id: "original", name: "Original workout", description: "Prescription", scheme: "reps", roundsToScore: 1 }, scalingLevels: [], teamId: "team-personal", trainingDate: "2026-08-10", personalSessionId: "session-owned", personalItemId: "item-original", personalRevision: 3 }
  mock.getPersonalDay.mockResolvedValue({ personalSession: {
    id: "session-owned", teamId: "team-personal", trainingDate: "2026-08-10", revision: 4,
    items: [{ id: "item-original", kind: "library", workoutId: "original" }, { id: "concurrent-item", kind: "library", workoutId: "concurrent" }],
  } })
  mock.savePersonalSession.mockImplementation(async ({ data }) => ({ ...data, id: "session-owned", revision: data.expectedRevision + 1 }))
})
describe("workout import route handoffs", () => {
  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Log date and notes]]
  it("appends the imported workout to the current personal day and keeps notes without logging", async () => {
    const Page = LogRoute.options.component as ComponentType
    const { rerender } = render(<Page />)
    expect(screen.getByLabelText("Date")).toHaveAttribute("readonly")
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: "Keep my session notes" } })
    fireEvent.change(screen.getByLabelText("Score"), { target: { value: "75" } })
    fireEvent.click(screen.getByText("Finish entitled import"))
    await waitFor(() => expect(mock.navigate).toHaveBeenCalled())
    expect(mock.getPersonalDay).toHaveBeenCalledWith({ data: { teamId: "team-personal", trainingDate: "2026-08-10" } })
    const itemId = mock.savePersonalSession.mock.calls[0][0].data.items[2].id
    expect(mock.savePersonalSession).toHaveBeenCalledWith({ data: {
      teamId: "team-personal", trainingDate: "2026-08-10", expectedRevision: 4,
      items: [{ id: "item-original", kind: "library", workoutId: "original" }, { id: "concurrent-item", kind: "library", workoutId: "concurrent" }, { id: itemId, kind: "library", workoutId: "imported" }],
    } })
    expect(mock.navigate).toHaveBeenCalledWith({ to: "/log/new", search: {
      workoutId: "imported", teamId: "team-personal", date: "2026-08-10", personalSessionId: "session-owned", personalItemId: itemId, personalRevision: 5, returnSurface:"session", returnTrackId:undefined,
    } })
    mock.data = { ...mock.data, personalItemId: itemId, personalRevision: 5, selectedWorkout: { id: "imported", name: "New workout", description: "New prescription", scheme: "reps", roundsToScore: 1 } }
    rerender(<Page />)
    expect(screen.getByLabelText("Date")).toHaveValue("2026-08-10")
    expect(screen.getByLabelText(/Notes/)).toHaveValue("Keep my session notes")
    expect(screen.getByLabelText("Score")).toHaveValue("")
    expect(mock.submitDirectLog).not.toHaveBeenCalled()
    expect(mock.submitPersonalLog).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Personal attachment retry]]
  it("reuses an attached occurrence after its composition response is lost", async () => {
    const Page = LogRoute.options.component as ComponentType
    render(<Page />)
    mock.savePersonalSession.mockImplementationOnce(async ({ data }) => {
      mock.getPersonalDay.mockResolvedValue({ personalSession: { ...data, id: "session-owned", revision: 5 } })
      throw new Error("Response lost")
    })
    fireEvent.click(screen.getByText("Finish entitled import"))
    await waitFor(() => expect(mock.importFailed).toHaveBeenCalled())
    expect(mock.navigate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("Finish entitled import"))
    await waitFor(() => expect(mock.navigate).toHaveBeenCalled())
    expect(mock.savePersonalSession).toHaveBeenCalledTimes(1)
    expect(mock.navigate.mock.calls[0][0].search.personalItemId).toBe(mock.savePersonalSession.mock.calls[0][0].data.items[2].id)
    expect(mock.submitDirectLog).not.toHaveBeenCalled()
    expect(mock.submitPersonalLog).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Personal attachment conflict]]
  it("keeps the current log inputs when the composition rejects a stale save", async () => {
    const Page = LogRoute.options.component as ComponentType
    render(<Page />)
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: "Unsaved notes" } })
    fireEvent.change(screen.getByLabelText("Score"), { target: { value: "75" } })
    mock.savePersonalSession.mockRejectedValueOnce(new Error("CONFLICT: Refresh session"))
    fireEvent.click(screen.getByText("Finish entitled import"))
    await waitFor(() => expect(mock.importFailed).toHaveBeenCalled())
    expect(screen.getByLabelText(/Notes/)).toHaveValue("Unsaved notes")
    expect(screen.getByLabelText("Score")).toHaveValue("75")
    expect(mock.navigate).not.toHaveBeenCalled()
    expect(mock.submitDirectLog).not.toHaveBeenCalled()
    expect(mock.submitPersonalLog).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Legacy log handoff]]
  it("opens workout-only log links directly without creating a session", async () => {
    const loader = LogRoute.options.loader as (options: unknown) => Promise<unknown>
    await expect(loader({ deps: { workoutId: "original" } })).resolves.toMatchObject({selectedWorkout:{id:"original"},teamId:"team-personal",personalSessionId:undefined})
    expect(mock.getPersonalDay).not.toHaveBeenCalled()
    expect(mock.savePersonalSession).not.toHaveBeenCalled()
    expect(mock.submitDirectLog).not.toHaveBeenCalled()
    expect(mock.submitPersonalLog).not.toHaveBeenCalled()
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Track alias placement]]
  it.each([SettingsRoute, AdminRoute])("preserves displayed track destination, order and notes through the shared adapter", async (route) => {
    mock.data = { canManageWorkouts: true, track: { id: "track-owned", name: "Strength", ownerTeamId: "team-owner" }, trackWorkouts: [], teamId: "team-owner", teamName: "Gym" }
    const Page = route.options.component as ComponentType
    render(<Page />)
    fireEvent.click(screen.getByRole("button", { name: "Add workout" }))
    fireEvent.change(screen.getByLabelText("Track Order"), { target: { value: "8" } })
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Keep track coaching notes" } })
    fireEvent.click(screen.getByRole("button", { name: "Import workout" }))
    expect(mock.panelProps).toMatchObject({ destination: { kind: "track", trackId: "track-owned" }, track: { trackOrder: 8, notes: "Keep track coaching notes" }, saveLabel: "Create and add to track" })
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "Finish track import" }))
    await waitFor(() => expect(mock.invalidate).toHaveBeenCalled())
  })
})

// @lat: [[workout-import-ux-tests#Workout Import UX Tests#Subscriber track action]]
it("hides manual and AI add actions for a track without owner-team management permission", () => {
  mock.data = { canManageWorkouts: false, track: { id: "subscribed", name: "Subscribed track", ownerTeamId: "foreign-owner" }, trackWorkouts: [] }
  const Page = SettingsRoute.options.component as ComponentType
  render(<Page />)
  expect(screen.queryByRole("button", { name: "Add workout" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Import workout" })).not.toBeInTheDocument()
})

// @lat: [[session-review-tests#New workout inputs reset without leaking notes]]
it("resets the unit, tiebreak and score when a different direct workout has the same shape",()=>{
 const levels:unknown[]=[]
 mock.data={...mock.data,personalSessionId:undefined,personalItemId:undefined,scalingLevels:levels,selectedWorkout:{id:"load-one",name:"Load one",scheme:"load",roundsToScore:1,tiebreakScheme:"time"}}
 const Page=LogRoute.options.component as ComponentType
 const view=render(<Page />)
 fireEvent.change(screen.getByLabelText("Weight unit"),{target:{value:"kg"}})
 fireEvent.change(screen.getByLabelText("Tiebreak (time)"),{target:{value:"1:00"}})
 fireEvent.change(screen.getByLabelText("Score"),{target:{value:"100"}})
 fireEvent.change(screen.getByLabelText(/Notes/),{target:{value:"Keep notes"}})
 mock.data={...mock.data,selectedWorkout:{id:"load-two",name:"Load two",scheme:"load",roundsToScore:1,tiebreakScheme:"time"}}
 view.rerender(<Page />)
 expect(screen.getByLabelText("Weight unit")).toHaveValue("lb")
 expect(screen.getByLabelText("Tiebreak (time)")).toHaveValue("")
 expect(screen.getByLabelText("Score")).toHaveValue("")
 expect(screen.getByLabelText(/Notes/)).toHaveValue("")
})

// @lat: [[session-navigation-tests#Imported workout return context is not provenance]]
it("keeps track-origin return context on import without assigning the previous source to the imported workout", async () => {
  mock.search = {
    trackId: "source-track",
    sourceDate: "2026-08-01",
    returnSurface: "track",
  }
  const Page = LogRoute.options.component as ComponentType
  const view = render(<Page />)
  fireEvent.change(screen.getByLabelText(/Notes/), {
    target: { value: "Keep imported notes" },
  })
  fireEvent.click(screen.getByText("Finish entitled import"))
  await waitFor(() => expect(mock.navigate).toHaveBeenCalled())
  const search = mock.navigate.mock.calls[0][0].search
  expect(search).toMatchObject({
    returnTrackId: "source-track",
    returnSurface: "track",
    teamId: "team-personal",
    date: "2026-08-10",
  })
  expect(search.trackId).toBeUndefined()
  expect(search.sourceDate).toBeUndefined()
  const imported = mock.savePersonalSession.mock.calls[0][0].data.items.at(-1)
  expect(imported.sourceTrackId).toBeUndefined()
  expect(imported.sourceDate).toBeUndefined()
  mock.search = search
  mock.data = {
    ...mock.data,
    selectedWorkout: { id: "imported", name: "Imported", scheme: "reps" },
    personalItemId: search.personalItemId,
  }
  view.rerender(<Page />)
  const back = screen.getByRole("link", { name: "Back to training" })
  expect(
    Object.fromEntries(
      new URL(back.getAttribute("href")!, "https://example.com").searchParams,
    ),
  ).toMatchObject({
    teamId: "team-personal",
    date: "2026-08-10",
    trackId: "source-track",
    surface: "track",
  })
  expect(screen.getByLabelText(/Notes/)).toHaveValue("Keep imported notes")
})

// @lat: [[session-navigation-tests#Existing score redirect preserves return navigation]]
it("keeps return navigation when a new-log link finds an existing personal score", async () => {
  mock.getPersonalDay.mockResolvedValue({
    personalSession: {
      id: "session-owned",
      teamId: "team-personal",
      trainingDate: "2026-08-10",
      revision: 3,
      items: [{ id: "item-original", kind: "library", workoutId: "original" }],
    },
    libraryResults: [{ itemId: "item-original", scoreId: "saved-score" }],
  })
  const loader = LogRoute.options.loader as (
    options: unknown,
  ) => Promise<unknown>
  let redirected: unknown
  try {
    await loader({
      deps: {
        personalSessionId: "session-owned",
        personalItemId: "item-original",
        teamId: "team-personal",
        date: "2026-08-10",
        returnSurface: "session",
        returnTrackId: "browsed-track",
      },
    })
  } catch (cause) {
    redirected = cause
  }
  const href = (redirected as { href: string }).href
  expect(href).toContain("/log/saved-score/edit")
  expect(
    Object.fromEntries(
      new URL(
        new URL(href, "https://example.com").searchParams.get("redirectUrl")!,
        "https://example.com",
      ).searchParams,
    ),
  ).toEqual({
    teamId: "team-personal",
    date: "2026-08-10",
    surface: "session",
    trackId: "browsed-track",
  })
})

// @lat: [[session-navigation-tests#Log form selects distinct personal and direct writers]]
it.each(["personal", "direct"] as const)(
  "submits the real %s score form only to its matching writer",
  async (mode) => {
    mock.search = { trackId: "source-track", sourceDate: "2026-08-01" }
    if (mode === "direct")
      mock.data = {
        ...mock.data,
        personalSessionId: undefined,
        personalItemId: undefined,
        personalRevision: undefined,
      }
    const Page = LogRoute.options.component as ComponentType
    render(<Page />)
    fireEvent.change(screen.getByLabelText("Score"), {
      target: { value: "12" },
    })
    fireEvent.change(screen.getByLabelText(/Notes/), {
      target: { value: "Private result" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save result" }))
    const selected =
      mode === "personal" ? mock.submitPersonalLog : mock.submitDirectLog
    const other =
      mode === "personal" ? mock.submitDirectLog : mock.submitPersonalLog
    await waitFor(() => expect(selected).toHaveBeenCalledTimes(1))
    expect(other).not.toHaveBeenCalled()
    const data = selected.mock.calls[0][0].data
    expect(data).toMatchObject({
      score: "12",
      notes: "Private result",
      unit: "lb",
      asRx: true,
    })
    if (mode === "personal") {
      expect(data).toMatchObject({
        personalSessionId: "session-owned",
        itemId: "item-original",
        expectedRevision: 3,
      })
      expect(data).not.toHaveProperty("workoutId")
      expect(data).not.toHaveProperty("sourceTrackId")
    } else {
      expect(data).toMatchObject({
        teamId: "team-personal",
        trainingDate: "2026-08-10",
        workoutId: "original",
        sourceTrackId: "source-track",
        sourceDate: "2026-08-01",
        itemId: expect.any(String),
      })
      expect(data).not.toHaveProperty("personalSessionId")
      expect(data).not.toHaveProperty("expectedRevision")
    }
    expect(mock.savePersonalSession).not.toHaveBeenCalled()
  },
)
